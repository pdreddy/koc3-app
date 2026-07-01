import type { EpochMillis } from './common';

export interface ScheduleEntry {
  id: string;
  group: string;
  round: number;
  date: string; // YYYY-MM-DD
  time: string;
  team1Id: string;
  team2Id: string;
  status: 'SCHEDULED' | 'PLAYED' | 'POSTPONED' | 'CANCELLED';
  matchId: string | null;
  createdAt: EpochMillis;
}
