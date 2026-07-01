// Shared primitive types used across the platform's data model.

export type Role =
  | 'SUPER_ADMIN'
  | 'TOURNAMENT_ADMIN'
  | 'ORGANIZER'
  | 'CAPTAIN'
  | 'VICE_CAPTAIN'
  | 'PLAYER'
  | 'GUEST'
  | 'PUBLIC';

// Per-page access level, set by the tournament admin in Step 10 of the wizard / settings.
export type VisibilityLevel = 'PUBLIC' | 'LOGIN_REQUIRED' | 'REGISTERED_PLAYER' | 'CAPTAIN' | 'ADMIN' | 'HIDDEN';

export type TournamentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type TournamentType =
  | 'KOC_LEAGUE'
  | 'UTR_LEAGUE'
  | 'SINGLES_LEAGUE'
  | 'DOUBLES_LEAGUE'
  | 'MIXED_LEAGUE'
  | 'TEAM_LEAGUE'
  | 'ROUND_ROBIN'
  | 'KNOCKOUT'
  | 'DOUBLE_ELIMINATION'
  | 'SWISS'
  | 'LADDER'
  | 'CHALLENGE_COURT'
  | 'GROUP_PLUS_KNOCKOUT'
  | 'CUSTOM';

// Milliseconds since epoch, stored as a plain number (Firestore Timestamp is converted
// to/from this at the repository boundary — see services/firestoreConverters.ts).
export type EpochMillis = number;
