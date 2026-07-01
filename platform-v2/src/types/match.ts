import type { EpochMillis } from './common';
import type { MatchTypeCode } from './tournament';

export type MatchLineStatus = 'SCHEDULED' | 'COMPLETED' | 'WALKOVER' | 'RETIRED' | 'CANCELLED';

export interface SetScore {
  set: number;
  team1: number;
  team2: number;
  tiebreak?: { team1: number; team2: number };
  matchTiebreak?: { team1: number; team2: number };
}

export interface MatchLine {
  label: string;
  type: MatchTypeCode;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  sets: SetScore[];
  status: MatchLineStatus;
}

export type MatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED' | 'DISPUTED' | 'CANCELLED';

export interface Match {
  id: string;
  scheduleEntryId: string | null;
  playoffMatchId: string | null; // set instead of scheduleEntryId when this Match belongs to a playoffMatches bracket slot
  team1Id: string;
  team2Id: string;
  lines: MatchLine[];
  winnerTeamId: string | null;
  status: MatchStatus;
  enteredBy: string | null;
  approvedBy: string | null;
  playedAt: EpochMillis | null;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
}
