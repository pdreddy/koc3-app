import type { Role } from './common';

// platform/tournaments/{tournamentId}/permissions/{userId} — a per-tournament role
// assignment for a given (global) auth user. SUPER_ADMIN is platform-wide and is not
// stored per-tournament (see AuthContext).
export interface TournamentPermission {
  userId: string;
  tournamentId: string;
  role: Exclude<Role, 'SUPER_ADMIN' | 'GUEST' | 'PUBLIC'>;
  teamId: string | null; // set when role is CAPTAIN/VICE_CAPTAIN/PLAYER
  grantedAt: number;
  grantedBy: string;
}
