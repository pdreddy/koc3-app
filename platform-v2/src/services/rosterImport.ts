import Papa from 'papaparse';
import type { Player, PlayerImportRow } from '@/types';

export type ParsedImport = { rows: PlayerImportRow[]; errors: string[] };

export function parseCsv(text: string): ParsedImport {
  const result = Papa.parse<PlayerImportRow>(text, { header: true, skipEmptyLines: true });
  const errors = result.errors.map((e) => `Row ${e.row ?? '?'}: ${e.message}`);
  return { rows: result.data, errors };
}

export function parseJson(text: string): ParsedImport {
  try {
    const parsed = JSON.parse(text);
    const rows: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.players) ? parsed.players : [];
    if (rows.length === 0) return { rows: [], errors: ['JSON must be an array of players, or an object with a "players" array.'] };
    return { rows: rows as PlayerImportRow[], errors: [] };
  } catch (e) {
    return { rows: [], errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
}

// Recognized column header aliases -> canonical Player field. Import UI lets the admin
// confirm/adjust this mapping before committing (column names in real spreadsheets vary a
// lot — "First" vs "First Name" vs "firstName" etc).
export const COLUMN_ALIASES: Record<string, keyof Player> = {
  'first name': 'firstName', firstname: 'firstName', first: 'firstName',
  'last name': 'lastName', lastname: 'lastName', last: 'lastName',
  'display name': 'displayName', displayname: 'displayName', name: 'displayName',
  phone: 'phone', 'phone number': 'phone', mobile: 'phone',
  email: 'email', 'email address': 'email',
  gender: 'gender', sex: 'gender',
  age: 'age',
  utr: 'utrRating', 'utr rating': 'utrRating',
  ntrp: 'ntrpRating', 'ntrp rating': 'ntrpRating',
  usta: 'usta',
  city: 'city',
  availability: 'availability',
  'preferred position': 'preferredPosition', position: 'preferredPosition',
  handedness: 'handedness', hand: 'handedness',
  'captain eligible': 'captainEligible', captain: 'captainEligible',
  notes: 'notes',
};

export function guessColumnMapping(headers: string[]): Record<string, keyof Player | null> {
  const mapping: Record<string, keyof Player | null> = {};
  headers.forEach((header) => {
    mapping[header] = COLUMN_ALIASES[header.trim().toLowerCase()] ?? null;
  });
  return mapping;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ['true', 'yes', 'y', '1'].includes(value.trim().toLowerCase());
}

function parseNumberOrNull(value: string | undefined): number | null {
  if (!value || !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapRowToPlayer(row: PlayerImportRow, mapping: Record<string, keyof Player | null>, now: number): Omit<Player, 'id'> {
  const getValue = (field: keyof Player): string | undefined => {
    const header = Object.entries(mapping).find(([, mapped]) => mapped === field)?.[0];
    return header ? row[header] : undefined;
  };

  const firstName = getValue('firstName') ?? '';
  const lastName = getValue('lastName') ?? '';
  const displayName = getValue('displayName') || [firstName, lastName].filter(Boolean).join(' ').trim();

  return {
    firstName,
    lastName,
    displayName: displayName || 'Unnamed Player',
    phone: getValue('phone') || null,
    email: getValue('email') || null,
    gender: (getValue('gender')?.toUpperCase() as Player['gender']) || null,
    age: parseNumberOrNull(getValue('age')),
    utrRating: parseNumberOrNull(getValue('utrRating')),
    ntrpRating: parseNumberOrNull(getValue('ntrpRating')),
    usta: getValue('usta') || null,
    city: getValue('city') || null,
    availability: getValue('availability') || null,
    preferredPosition: getValue('preferredPosition') || null,
    handedness: (getValue('handedness')?.toUpperCase() as Player['handedness']) || null,
    captainEligible: parseBoolean(getValue('captainEligible')),
    notes: getValue('notes') || null,
    teamId: null,
    isCaptain: false,
    isViceCaptain: false,
    importedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeForDuplicateKey(player: Omit<Player, 'id'>): string {
  if (player.email) return `email:${player.email.trim().toLowerCase()}`;
  if (player.phone) return `phone:${player.phone.replace(/\D/g, '')}`;
  return `name:${player.displayName.trim().toLowerCase()}`;
}

export interface DuplicateGroup {
  key: string;
  players: Omit<Player, 'id'>[];
}

/** Groups import rows that look like the same person (matched by email, else phone, else
 * exact display name) so the admin can review before deciding whether to merge or import
 * as separate players. */
export function detectDuplicates(players: Omit<Player, 'id'>[]): { unique: Omit<Player, 'id'>[]; duplicateGroups: DuplicateGroup[] } {
  const byKey = new Map<string, Omit<Player, 'id'>[]>();
  players.forEach((p) => {
    const key = normalizeForDuplicateKey(p);
    const group = byKey.get(key) ?? [];
    group.push(p);
    byKey.set(key, group);
  });

  const unique: Omit<Player, 'id'>[] = [];
  const duplicateGroups: DuplicateGroup[] = [];
  byKey.forEach((group, key) => {
    if (group.length === 1) unique.push(group[0]);
    else duplicateGroups.push({ key, players: group });
  });
  return { unique, duplicateGroups };
}
