import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
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

const tournamentsCollection = collection(db, 'platform', 'tournaments').withConverter(identityConverter<Tournament>());

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
    return { ...draft, id: ref.id };
  },

  async updateConfig(id: string, patch: Partial<TournamentConfig>, updatedBy: string): Promise<void> {
    await updateDoc(doc(tournamentsCollection, id), {
      config: patch,
      updatedAt: Date.now(),
      updatedBy,
    } as Record<string, unknown>);
  },

  async setStatus(id: string, status: Tournament['status'], updatedBy: string): Promise<void> {
    await updateDoc(doc(tournamentsCollection, id), {
      status,
      archivedAt: status === 'ARCHIVED' ? Date.now() : null,
      updatedAt: Date.now(),
      updatedBy,
    } as Record<string, unknown>);
  },

  async publish(id: string, updatedBy: string): Promise<void> {
    return this.setStatus(id, 'PUBLISHED', updatedBy);
  },

  async archive(id: string, updatedBy: string): Promise<void> {
    return this.setStatus(id, 'ARCHIVED', updatedBy);
  },

  async duplicate(id: string, createdBy: string): Promise<Tournament> {
    const original = await this.get(id);
    if (!original) throw new Error(`Tournament ${id} not found`);
    return this.create({ name: `${original.config.info.name} (Copy)`, createdBy, config: original.config });
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
