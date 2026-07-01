import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type CollectionReference,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { identityConverter } from './firestoreConverters';
import { TOURNAMENTS_COLLECTION } from './firestorePaths';

// Every read/write in this platform goes through a repository built by this factory, so
// no component or service ever writes a Firestore path by hand — the tournamentId scoping
// is baked in at construction time. This is the concrete answer to "no hardcoded Firebase
// paths": call tournamentRepository<Team>(tournamentId, 'teams') once, then use plain CRUD
// methods everywhere else.
export class TournamentScopedRepository<T extends { id: string }> {
  private readonly collectionRef: CollectionReference<T>;

  constructor(tournamentId: string, subcollection: string) {
    if (!tournamentId) throw new Error('TournamentScopedRepository requires a non-empty tournamentId');
    this.collectionRef = collection(db, TOURNAMENTS_COLLECTION, tournamentId, subcollection).withConverter(
      identityConverter<T>()
    );
  }

  private docRef(id: string): DocumentReference<T> {
    return doc(this.collectionRef, id);
  }

  async list(): Promise<T[]> {
    const snap = await getDocs(this.collectionRef);
    return snap.docs.map((d) => d.data());
  }

  async get(id: string): Promise<T | null> {
    const snap = await getDoc(this.docRef(id));
    return snap.exists() ? snap.data() : null;
  }

  /** Creates a document with an auto-generated id. */
  async create(data: Omit<T, 'id'>): Promise<T> {
    const ref = await addDoc(this.collectionRef, data as T);
    return { ...(data as T), id: ref.id };
  }

  /** Creates (or overwrites) a document at a caller-chosen id — e.g. a stable team/player slot id. */
  async setWithId(id: string, data: Omit<T, 'id'>): Promise<T> {
    await setDoc(this.docRef(id), data as T);
    return { ...(data as T), id };
  }

  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<void> {
    await updateDoc(this.docRef(id), patch as Record<string, unknown>);
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }

  subscribeAll(onChange: (items: T[]) => void): Unsubscribe {
    return onSnapshot(this.collectionRef, (snap) => onChange(snap.docs.map((d) => d.data())));
  }

  subscribeOne(id: string, onChange: (item: T | null) => void): Unsubscribe {
    return onSnapshot(this.docRef(id), (snap) => onChange(snap.exists() ? snap.data() : null));
  }
}

// Convenience factory — the only thing most call sites should ever need.
export function tournamentRepository<T extends { id: string }>(
  tournamentId: string,
  subcollection: 'teams' | 'players' | 'matches' | 'schedules' | 'standings' | 'permissions'
): TournamentScopedRepository<T> {
  return new TournamentScopedRepository<T>(tournamentId, subcollection);
}
