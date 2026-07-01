import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { identityConverter } from './firestoreConverters';
import type { Tournament, TournamentConfig } from '@/types';
import { buildDefaultTournamentConfig } from './defaultTournamentConfig';
import { TOURNAMENTS_COLLECTION } from './firestorePaths';
import { writeAuditLog } from './auditService';

const tournamentsCollection = collection(db, TOURNAMENTS_COLLECTION).withConverter(identityConverter<Tournament>());

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tournament';
}

// Top-level CRUD for the Tournament doc itself — the "Tournament Manager" dashboard and
// Create Tournament wizard are the only callers of this module. Everything else (teams,
// players, matches, ...) goes through TournamentRepository, scoped by the tournament's id.
export const TournamentService = {
  async list(): Promise<Tournament[]> {
    const snap = await getDocs(tournamentsCollection);
    return snap.docs.map((d) => d.data());
  },

  async get(id: string): Promise<Tournament | null> {
    const snap = await getDoc(doc(tournamentsCollection, id));
    return snap.exists() ? snap.data() : null;
  },

  async getBySlug(slug: string): Promise<Tournament | null> {
    const q = query(tournamentsCollection, where('slug', '==', slug), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data();
  },

  subscribeAll(onChange: (tournaments: Tournament[]) => void): Unsubscribe {
    return onSnapshot(tournamentsCollection, (snap) => onChange(snap.docs.map((d) => d.data())));
  },

  async create(params: {
    name: string;
    createdBy: string;
    createdByEmail?: string | null;
    config?: Partial<TournamentConfig>;
  }): Promise<Tournament> {
    const now = Date.now();
    const baseSlug = slugify(params.name);
    // Best-effort uniqueness: append a short suffix if the slug is already taken. Not
    // transactional — acceptable for an admin-only, low-frequency creation flow.
    const existing = await this.getBySlug(baseSlug);
    const slug = existing ? `${baseSlug}-${now.toString(36).slice(-4)}` : baseSlug;

    const config: TournamentConfig = {
      ...buildDefaultTournamentConfig(),
      ...params.config,
      info: { ...buildDefaultTournamentConfig().info, ...params.config?.info, name: params.name },
    };

    const draft: Omit<Tournament, 'id'> = {
      slug,
      status: 'DRAFT',
      config,
      createdAt: now,
      createdBy: params.createdBy,
      updatedAt: now,
      updatedBy: params.createdBy,
      archivedAt: null,
    };
    const ref = await addDoc(tournamentsCollection, draft as Tournament);

    // Bootstrap the creator as this tournament's admin — without this, nobody would ever
    // pass isTournamentAdmin() in firestore.rules for a tournament they just created,
    // since permission docs are the *only* thing those rules check (see the rules file's
    // header comment for why custom claims were deliberately avoided). The rule allowing
    // this specific self-write checks that the caller matches the tournament's createdBy.
    await setDoc(doc(db, TOURNAMENTS_COLLECTION, ref.id, 'permissions', params.createdBy), {
      userId: params.createdBy,
      tournamentId: ref.id,
      role: 'TOURNAMENT_ADMIN',
      teamId: null,
      grantedAt: now,
      grantedBy: params.createdBy,
    });

    const created = { ...draft, id: ref.id };
    await writeAuditLog(ref.id, 'TOURNAMENT_CREATED', { uid: params.createdBy, email: params.createdByEmail ?? null }, 'tournament', ref.id, { name: params.name });
    return created;
  },

  // Takes a *complete* TournamentConfig, not a partial — Firestore's updateDoc only does a
  // shallow merge at the top level of the document, so `{ config: X }` REPLACES the entire
  // nested config object with X. A Partial<TournamentConfig> here would silently wipe every
  // field the caller didn't include. Callers building an edit form should keep a full draft
  // in memory (see useConfigDraft) and pass the whole thing back on save, not a diff.
  async updateConfig(id: string, config: TournamentConfig, updatedBy: string, updatedByEmail: string | null = null): Promise<void> {
    await updateDoc(doc(tournamentsCollection, id), {
      config,
      updatedAt: Date.now(),
      updatedBy,
    } as Record<string, unknown>);
    await writeAuditLog(id, 'CONFIG_UPDATED', { uid: updatedBy, email: updatedByEmail }, 'tournament', id);
  },

  async setStatus(id: string, status: Tournament['status'], updatedBy: string, updatedByEmail: string | null = null): Promise<void> {
    await updateDoc(doc(tournamentsCollection, id), {
      status,
      archivedAt: status === 'ARCHIVED' ? Date.now() : null,
      updatedAt: Date.now(),
      updatedBy,
    } as Record<string, unknown>);
    if (status === 'PUBLISHED') await writeAuditLog(id, 'TOURNAMENT_PUBLISHED', { uid: updatedBy, email: updatedByEmail }, 'tournament', id);
    if (status === 'ARCHIVED') await writeAuditLog(id, 'TOURNAMENT_ARCHIVED', { uid: updatedBy, email: updatedByEmail }, 'tournament', id);
  },

  async publish(id: string, updatedBy: string, updatedByEmail: string | null = null): Promise<void> {
    return this.setStatus(id, 'PUBLISHED', updatedBy, updatedByEmail);
  },

  async archive(id: string, updatedBy: string, updatedByEmail: string | null = null): Promise<void> {
    return this.setStatus(id, 'ARCHIVED', updatedBy, updatedByEmail);
  },

  async duplicate(id: string, createdBy: string, createdByEmail: string | null = null): Promise<Tournament> {
    const original = await this.get(id);
    if (!original) throw new Error(`Tournament ${id} not found`);
    return this.create({ name: `${original.config.info.name} (Copy)`, createdBy, createdByEmail, config: original.config });
  },

  /** Deletes the tournament document only. Subcollections (teams/players/matches/...) must
   * be deleted separately (e.g. via a Cloud Function) — Firestore does not cascade-delete
   * subcollections automatically. Intentionally not implemented client-side to avoid an
   * admin accidentally triggering a large, slow, partially-failing bulk delete from the
   * browser; see memory note in the platform README once written. */
  async deleteTournamentDocOnly(id: string): Promise<void> {
    await deleteDoc(doc(tournamentsCollection, id));
  },
};
