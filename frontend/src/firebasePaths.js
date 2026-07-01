import { DEFAULT_CLUB_ID, getClub } from './config/clubs';
import { DEFAULT_TOURNAMENT_ID, PLATFORM_ROOT } from './config/tournamentPlatform';

let currentTournamentId = DEFAULT_TOURNAMENT_ID;

export function setCurrentTournamentId(tournamentId = DEFAULT_TOURNAMENT_ID) {
  currentTournamentId = normalizeTournamentId(tournamentId);
}

export function getCurrentTournamentId() {
  return currentTournamentId;
}

export function normalizeTournamentId(value) {
  return String(value || DEFAULT_TOURNAMENT_ID)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || DEFAULT_TOURNAMENT_ID;
}

export function tournamentRoot(tournamentId = currentTournamentId) {
  return `${PLATFORM_ROOT}/${normalizeTournamentId(tournamentId)}`;
}

// Firebase RTDB paths are centralized and tournament-scoped. Existing KOC screens
// keep importing PATHS, but each property now resolves against the selected tournament.
export function buildPaths(tournamentId = currentTournamentId) {
  const root = tournamentRoot(tournamentId);
  const seasonPath = (child) => `${root}/${child}`;
  return {
    root,
    config: seasonPath('config'),
    permissions: seasonPath('permissions'),
    branding: seasonPath('branding'),
    registration: seasonPath('registration'),
    players: seasonPath('players'),
    teams: seasonPath('teams'),
    captains: seasonPath('captains'),
    groups: seasonPath('groups'),
    matches: seasonPath('matches'),
    lineups: seasonPath('lineups'),
    scores: seasonPath('scores'),
    admin: seasonPath('admin'),
    adminUsers: seasonPath('adminUsers'),
    schedule: seasonPath('schedules'),
    schedules: seasonPath('schedules'),
    settings: seasonPath('settings'),
    standings: seasonPath('standings'),
    rankings: seasonPath('rankings'),
    playoffs: seasonPath('playoffs'),
    statistics: seasonPath('statistics'),
    rules: seasonPath('rules'),
    announcements: seasonPath('announcements'),
    gallery: seasonPath('gallery'),
    sponsors: seasonPath('sponsors'),
    documents: seasonPath('documents'),
    notifications: seasonPath('notifications'),
    history: seasonPath('history'),
    auditLogs: seasonPath('auditLogs'),
    pprcRatings: seasonPath('rankings/pprcRatings'),
    playerRatings: seasonPath('rankings/playerRatings'),
    playerHistory: seasonPath('history/playerHistory'),
    teamHistory: seasonPath('history/teamHistory'),
    playerMatchups: seasonPath('statistics/playerMatchups'),
    teamMatchups: seasonPath('statistics/teamMatchups'),
    playerEligibility: seasonPath('registration/playerEligibility'),
    cachedSummaries: seasonPath('statistics/cachedSummaries'),
    lineupSubmissions: seasonPath('lineups/submissions'),
    lineupSubmissionMeta: seasonPath('lineups/submissionMeta'),
    revealedLineups: seasonPath('lineups/revealed'),
    lineupUnlocks: seasonPath('lineups/unlocks'),
    lineupDeletes: seasonPath('lineups/deletes'),
    koc2db: seasonPath('history/KOC2DB'),
    season1: seasonPath('history/KOC2DBPONEW')
  };
}

export function getTournamentPaths(tournamentId = currentTournamentId) {
  return buildPaths(tournamentId);
}

// Compatibility seam for the existing ClubContext API. The platform migration now
// scopes runtime reads/writes by tournament, but older club-aware setup code still
// imports getClubPaths(). Keep that export available and map the current KOC club
// to the selected tournament namespace so Vite dependency scanning and existing
// consumers continue to work during the migration.
export function getClubPaths(clubId = DEFAULT_CLUB_ID) {
  const club = getClub(clubId);
  return getTournamentPaths(club?.defaultTournamentId || DEFAULT_TOURNAMENT_ID);
}

export const PATHS = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'toJSON') return () => buildPaths(currentTournamentId);
    return buildPaths(currentTournamentId)[prop];
  },
  ownKeys() { return Reflect.ownKeys(buildPaths(currentTournamentId)); },
  getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; }
});
