import type { DocumentData, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions } from 'firebase/firestore';

// Generic converter factory: works for any type T whose Firestore representation is a
// plain JSON-serializable object (our types are — see types/*.ts). Attaches the document
// id as `id` on read, strips it on write (Firestore keeps id as the doc key, not a field).
export function identityConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(model: T): DocumentData {
      const { id: _id, ...rest } = model;
      return rest;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): T {
      const data = snapshot.data(options);
      return { ...(data as T), id: snapshot.id };
    },
  };
}
