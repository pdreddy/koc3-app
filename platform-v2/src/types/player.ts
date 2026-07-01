import type { EpochMillis } from './common';

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  age: number | null;
  utrRating: number | null;
  ntrpRating: number | null;
  usta: string | null;
  city: string | null;
  availability: string | null;
  preferredPosition: string | null;
  handedness: 'LEFT' | 'RIGHT' | null;
  captainEligible: boolean;
  notes: string | null;
  teamId: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  importedAt: EpochMillis | null;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
}

// Raw row shape coming out of a CSV/JSON import, before validation/mapping.
export type PlayerImportRow = Partial<Record<keyof Player, string>> & Record<string, string>;
