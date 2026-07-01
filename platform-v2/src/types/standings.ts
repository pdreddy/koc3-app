import type { EpochMillis } from './common';

export interface StandingsEntry {
  teamId: string;
  group: string | null;
  played: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  bonusPoints: number;
  penaltyPoints: number;
  position: number;
  updatedAt: EpochMillis;
}
