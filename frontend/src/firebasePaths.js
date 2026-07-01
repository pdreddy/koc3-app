import { DEFAULT_CLUB_ID, getClub } from './config/clubs';

// Firebase RTDB paths are centralized here so current-season data and legacy archives stay
// separated. buildPaths() is a factory so each club can be pointed at its own isolated
// dataRoot; KOC's dataRoot is `koc_s3` (unchanged from before multi-club support existed),
// so the default PATHS export below is byte-identical to the pre-multi-club version.
export function buildPaths(dataRoot) {
  const seasonPath = (child) => `${dataRoot}/${child}`;
  return {
    teams: seasonPath('teams'),
    matches: seasonPath('matches'),
    playerRatings: seasonPath('playerRatings'),
    admin: seasonPath('admin'),
    adminUsers: seasonPath('adminUsers'),
    schedule: seasonPath('schedule'),
    settings: seasonPath('settings'),
    standings: seasonPath('standings'),
    pprcRatings: seasonPath('pprcRatings'),
    playerHistory: seasonPath('playerHistory'),
    teamHistory: seasonPath('teamHistory'),
    playerMatchups: seasonPath('playerMatchups'),
    teamMatchups: seasonPath('teamMatchups'),
    playerEligibility: seasonPath('playerEligibility'),
    cachedSummaries: seasonPath('cachedSummaries'),
    auditLogs: seasonPath('auditLogs'),
    lineupSubmissions: seasonPath('lineupSubmissions'),
    lineupSubmissionMeta: seasonPath('lineupSubmissionMeta'),
    revealedLineups: seasonPath('revealedLineups'),
    lineupUnlocks: seasonPath('lineupUnlocks'),
    lineupDeletes: seasonPath('lineupDeletes'),
    koc2db: 'KOC2DB',
    season1: 'KOC2DBPONEW'
  };
}

// Resolve the PATHS object for a given club (defaults to KOC — today's only club).
export function getClubPaths(clubId = DEFAULT_CLUB_ID) {
  return buildPaths(getClub(clubId).dataRoot);
}

// Back-compat default export: identical values to the pre-multi-club PATHS constant.
// Existing call sites (`import { PATHS } from './firebase'`) are untouched by this change.
export const PATHS = buildPaths(getClub(DEFAULT_CLUB_ID).dataRoot);
