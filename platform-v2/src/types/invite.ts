import type { Role } from './common';

// tournaments/{tournamentId}/invites/{normalizedEmail} — doc id is the invited email,
// normalized (trimmed + lowercased), so a signed-in user can look up "is there a pending
// invite for me" with a single get() instead of a query (Firestore security rules can't
// easily express "find the doc whose email field equals mine" without this).
export interface Invite {
  id: string; // == normalized email, same as the doc id
  email: string;
  tournamentId: string;
  role: Exclude<Role, 'SUPER_ADMIN' | 'GUEST' | 'PUBLIC'>;
  teamId: string | null;
  invitedBy: string;
  invitedAt: number;
  claimedBy: string | null; // uid, once claimed
  claimedAt: number | null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
