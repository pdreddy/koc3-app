import type { MatchTypeCode } from './tournament';

export interface LineupLine {
  label: string;
  matchType: MatchTypeCode;
  playerIds: string[];
}

// tournaments/{tournamentId}/lineups/{scheduleEntryId}__{teamId} — doc id is deterministic
// (not auto-generated) so both the client and firestore.rules can compute the *opponent's*
// doc id (same scheduleEntryId, other teamId) without a query, which is how the
// lock-then-reveal check works with no backend — see firestore.rules' opponentLineupLocked().
export interface LineupSubmission {
  id: string;
  scheduleEntryId: string;
  teamId: string;
  tournamentId: string;
  lines: LineupLine[];
  lockedAt: number | null;
  submittedBy: string;
  updatedAt: number;
}

export function lineupDocId(scheduleEntryId: string, teamId: string): string {
  return `${scheduleEntryId}__${teamId}`;
}
