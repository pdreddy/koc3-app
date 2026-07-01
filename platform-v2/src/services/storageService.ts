import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/firebase/config';

const MAX_BYTES = 5 * 1024 * 1024; // mirrors storage.rules' request.resource.size check

export class ImageUploadError extends Error {}

function validate(file: File): void {
  if (!file.type.startsWith('image/')) throw new ImageUploadError('Only image files are allowed.');
  if (file.size > MAX_BYTES) throw new ImageUploadError('Image must be under 5MB.');
}

/**
 * Uploads under tournaments/{tournamentId}/{path} — the path prefix storage.rules checks
 * isTournamentAdmin() against, so every caller must pass a path starting with a known
 * category (branding/, sponsors/, gallery/) to stay inside that admin-only subtree. Returns
 * a public download URL, the same shape every branding/sponsor/gallery field already
 * expects from manually-pasted URLs.
 */
export async function uploadTournamentImage(tournamentId: string, path: string, file: File): Promise<string> {
  validate(file);
  const storageRef = ref(storage, `tournaments/${tournamentId}/${path}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/** Best-effort delete — swallows errors (e.g. the URL wasn't actually a Storage object, or
 * was already removed), since a stale Storage file left behind isn't worth failing a UI
 * action over. */
export async function deleteTournamentImageByUrl(url: string): Promise<void> {
  try {
    await deleteObject(ref(storage, url));
  } catch {
    // ignore
  }
}
