import type { EpochMillis } from './common';

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  group: string | null;
  groupOrder: number | null;
  logoUrl: string | null;
  captainPlayerId: string | null;
  viceCaptainPlayerId: string | null;
  playerIds: string[];
  password: string | null; // legacy-compatible captain login secret; hashed at write time
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
}
