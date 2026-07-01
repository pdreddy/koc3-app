import type { EpochMillis, TournamentStatus, TournamentType, VisibilityLevel } from './common';

// ── Wizard Step 1: Tournament Information ─────────────────────────────────────────────
export interface TournamentInfo {
  name: string;
  season: string;
  clubName: string;
  leagueName: string;
  description: string;
  rulesText: string;
  shortName: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  theme: string;
  location: string;
  organizer: string;
  contactEmail: string;
  website: string;
  registrationOpensAt: EpochMillis | null;
  registrationClosesAt: EpochMillis | null;
  startsAt: EpochMillis | null;
  endsAt: EpochMillis | null;
  timezone: string;
  maxRegistrations: number | null;
}

// ── Wizard Step 3: Tournament Structure ────────────────────────────────────────────────
export interface TournamentStructure {
  groupCount: number;
  teamCount: number;
  playersPerTeam: number;
  captainRequired: boolean;
  viceCaptainRequired: boolean;
  benchPlayers: number;
  reservePlayers: number;
  maxPlayers: number;
  minPlayers: number;
  maxTeams: number;
  minTeams: number;
}

// ── Wizard Step 4: Player Configuration ────────────────────────────────────────────────
export interface PlayerConfig {
  minAge: number | null;
  maxAge: number | null;
  genderRule: 'ANY' | 'MEN' | 'WOMEN' | 'MIXED';
  utrRequired: boolean;
  ntrpRequired: boolean;
  skillRatingRequired: boolean;
  country: string | null;
  state: string | null;
  city: string | null;
  membershipRequired: boolean;
  registrationFee: number;
  approvalRequired: boolean;
  waitlistEnabled: boolean;
  maxRegistrations: number | null;
}

// ── Wizard Step 5: Match Types ─────────────────────────────────────────────────────────
export type MatchTypeCode =
  | 'SINGLES' | 'DOUBLES' | 'REVERSE_DOUBLES' | 'MIXED_DOUBLES'
  | 'REVERSE_SINGLES' | 'TEAM_MATCH' | 'PRACTICE_MATCH' | 'CHALLENGE_MATCH' | 'CUSTOM';

export interface MatchTypeConfig {
  code: MatchTypeCode;
  label: string;
  enabled: boolean;
  playersPerSide: number;
}

// A single line in a match day's lineup (e.g. "2 Singles + 3 Doubles + 1 Mixed").
export interface MatchLineupSlot {
  matchType: MatchTypeCode;
  count: number;
}

// ── Wizard Step 6: Scoring Configuration ───────────────────────────────────────────────
export type SetFormat = 'BEST_OF_3' | 'BEST_OF_5' | 'FAST_4' | 'PRO_SET_8' | 'PRO_SET_10' | 'SIX_GAME_SET' | 'FOUR_GAME_SET';
export type TiebreakFormat = 'TEN_POINT' | 'CHAMPIONSHIP' | 'GOLDEN_POINT' | 'NONE';
export type AdRule = 'NO_AD' | 'ADVANTAGE';

export interface ScoringConfig {
  setFormat: SetFormat;
  tiebreakFormat: TiebreakFormat;
  adRule: AdRule;
  gamesPerSet: number;
  setsToWin: number;
  setTiebreakMinPoints: number;
  setTiebreakWinBy: number;
  matchTiebreakMinPoints: number;
  matchTiebreakWinBy: number;
  allowWalkover: boolean;
  allowRetired: boolean;
  allowIncomplete: boolean;
  allowRainSuspended: boolean;
  allowCancelled: boolean;
}

// ── Wizard Step 7: Standings Configuration ─────────────────────────────────────────────
export type StandingsCriterion =
  | 'WINS' | 'LOSSES' | 'POINTS' | 'SETS_WON' | 'SETS_LOST' | 'GAME_DIFF'
  | 'GAMES_WON' | 'GAMES_LOST' | 'HEAD_TO_HEAD' | 'PERCENTAGE' | 'BONUS_POINTS'
  | 'PENALTY_POINTS' | 'CUSTOM_FORMULA';

export interface StandingsConfig {
  // Ordered by priority — admin can drag-and-drop reorder in the UI.
  tiebreakOrder: StandingsCriterion[];
  pointsPerWin: number;
  pointsPerLoss: number;
  bonusPointsEnabled: boolean;
  penaltyPointsEnabled: boolean;
  customFormula: string | null;
}

// ── Wizard Step 8: Playoff Configuration ───────────────────────────────────────────────
export type PlayoffQualifyCount = 2 | 4 | 8 | 16;
export type SeedingMethod = 'AUTOMATIC' | 'MANUAL' | 'RANDOM';

export interface PlayoffConfig {
  enabled: boolean;
  qualifyPerGroup: PlayoffQualifyCount;
  hasQuarterFinal: boolean;
  hasSemiFinal: boolean;
  hasFinal: boolean;
  hasThirdPlaceMatch: boolean;
  hasConsolationDraw: boolean;
  hasBronzeMatch: boolean;
  seedingMethod: SeedingMethod;
}

// ── Wizard Step 9: Registration Configuration ──────────────────────────────────────────
export type RegistrationMode = 'PUBLIC' | 'INVITE_ONLY';
export type ApprovalMode = 'NONE' | 'ADMIN_APPROVAL' | 'CAPTAIN_APPROVAL';

export interface RegistrationConfig {
  mode: RegistrationMode;
  approvalMode: ApprovalMode;
  paid: boolean;
  waitlistEnabled: boolean;
  replacementPlayersAllowed: boolean;
  closesAutomaticallyAtCapacity: boolean;
}

// ── Wizard Step 10: Screen Visibility ──────────────────────────────────────────────────
// Keyed by a stable page id (see pages registry) rather than a route string, so pages can
// be renamed/moved without breaking stored config.
export type VisibilityMap = Record<string, VisibilityLevel>;

export const DEFAULT_VISIBILITY: VisibilityMap = {
  home: 'PUBLIC',
  schedule: 'PUBLIC',
  standings: 'PUBLIC',
  teams: 'PUBLIC',
  gallery: 'PUBLIC',
  rules: 'PUBLIC',
  announcements: 'PUBLIC',
  playerProfiles: 'LOGIN_REQUIRED',
  captainDashboard: 'CAPTAIN',
  scoreEntry: 'CAPTAIN',
  adminDashboard: 'ADMIN',
  playerImport: 'ADMIN',
  tournamentSettings: 'ADMIN',
};

// ── Branding ────────────────────────────────────────────────────────────────────────────
export interface BrandingConfig {
  logoUrl: string | null;
  bannerUrl: string | null;
  backgroundUrl: string | null;
  themeColor: string;
  accentColor: string;
  fontFamily: string | null;
  sponsorImageUrls: string[];
  clubLogoUrl: string | null;
  partnerLogoUrls: string[];
  socialLinks: Record<string, string>;
  faviconUrl: string | null;
}

// ── The full, aggregated tournament configuration document ────────────────────────────
export interface TournamentConfig {
  info: TournamentInfo;
  type: TournamentType;
  structure: TournamentStructure;
  playerConfig: PlayerConfig;
  matchTypes: MatchTypeConfig[];
  lineup: MatchLineupSlot[];
  scoring: ScoringConfig;
  standings: StandingsConfig;
  playoffs: PlayoffConfig;
  registration: RegistrationConfig;
  visibility: VisibilityMap;
  branding: BrandingConfig;
}

// ── The Tournament document itself (platform/tournaments/{tournamentId}) ──────────────
export interface Tournament {
  id: string;
  slug: string; // public URL: /t/{slug}
  status: TournamentStatus;
  config: TournamentConfig;
  createdAt: EpochMillis;
  createdBy: string;
  updatedAt: EpochMillis;
  updatedBy: string;
  archivedAt: EpochMillis | null;
}
