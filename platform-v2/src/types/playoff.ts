import type { EpochMillis } from './common';

// Bracket depth is capped at 8 entrants (QUARTERFINAL -> SEMIFINAL -> FINAL) — there's no
// ROUND_OF_16 or later here. See services/playoffBracketGenerator.ts for how a qualified
// field larger than 8 is truncated to the top 8 seeds.
export type PlayoffRoundType = 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL' | 'THIRD_PLACE';

// tournaments/{tournamentId}/playoffMatches/{id} — id is deterministic (`${round}-${slot}`,
// see the generator), not auto-generated, so forward-reference fields below (nextMatchId,
// loserNextMatchId) can be computed at generation time without a second write pass.
export interface PlayoffMatch {
  id: string;
  round: PlayoffRoundType;
  slot: number; // 0-indexed position within the round
  team1Id: string | null; // null == "TBD" (either a bye slot or awaiting a previous round's winner)
  team2Id: string | null;
  team1Seed: number | null; // only set for a first-round slot seeded directly from standings
  team2Seed: number | null;
  matchId: string | null; // matches/{id} once a score has been entered for this bracket slot
  winnerTeamId: string | null; // set only once that Match is APPROVED (see ApproveScores.tsx)
  nextMatchId: string | null; // the winner advances into this playoffMatches doc...
  nextSlot: 'team1' | 'team2' | null; // ...at this slot
  loserNextMatchId: string | null; // e.g. a semifinal's loser feeds the third-place match
  loserNextSlot: 'team1' | 'team2' | null;
  createdAt: EpochMillis;
}
