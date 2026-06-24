import { DEFAULT_SEASON_SCOPE, normalizeSeasonScope } from './leagueConfig';

export const LEGACY_BASE = 'koc_s3';

export const LEGACY_PATHS = {
  teams: `${LEGACY_BASE}/teams`,
  matches: `${LEGACY_BASE}/matches`,
  playerRatings: `${LEGACY_BASE}/playerRatings`,
  admin: `${LEGACY_BASE}/admin`,
  adminUsers: `${LEGACY_BASE}/adminUsers`,
  schedule: `${LEGACY_BASE}/schedule`,
  settings: `${LEGACY_BASE}/settings`,
  standings: `${LEGACY_BASE}/standings`,
  pprcRatings: `${LEGACY_BASE}/pprcRatings`,
  playerHistory: `${LEGACY_BASE}/playerHistory`,
  teamHistory: `${LEGACY_BASE}/teamHistory`,
  playerMatchups: `${LEGACY_BASE}/playerMatchups`,
  teamMatchups: `${LEGACY_BASE}/teamMatchups`,
  playerEligibility: `${LEGACY_BASE}/playerEligibility`,
  cachedSummaries: `${LEGACY_BASE}/cachedSummaries`,
  auditLogs: `${LEGACY_BASE}/auditLogs`
};

const SEASON_COLLECTIONS = [
  'teams', 'matches', 'playerRatings', 'schedule', 'standings', 'pprcRatings',
  'playerHistory', 'teamHistory', 'playerMatchups', 'teamMatchups',
  'playerEligibility', 'cachedSummaries', 'auditLogs', 'registrations',
  'payments', 'invoices', 'refunds', 'courts', 'bookings', 'notifications',
  'reports', 'exports', 'openMatches', 'events'
];

const CLUB_COLLECTIONS = [
  'admin', 'adminUsers', 'members', 'playerProfiles', 'clubSettings',
  'branding', 'sponsors', 'marketplaceListing'
];

function cleanSegment(value, fallback) {
  return String(value || fallback || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'default';
}

export function buildTenantBase(scope = DEFAULT_SEASON_SCOPE) {
  const normalized = normalizeSeasonScope(scope);
  return {
    clubId: cleanSegment(normalized.clubId, DEFAULT_SEASON_SCOPE.clubId),
    seasonId: cleanSegment(normalized.seasonId, DEFAULT_SEASON_SCOPE.seasonId),
    clubBase: `clubs/${cleanSegment(normalized.clubId, DEFAULT_SEASON_SCOPE.clubId)}`,
    seasonBase: `clubs/${cleanSegment(normalized.clubId, DEFAULT_SEASON_SCOPE.clubId)}/seasons/${cleanSegment(normalized.seasonId, DEFAULT_SEASON_SCOPE.seasonId)}`
  };
}

export function buildTenantPaths(scope = DEFAULT_SEASON_SCOPE) {
  const base = buildTenantBase(scope);
  const paths = {
    legacy: LEGACY_PATHS,
    clubBase: base.clubBase,
    seasonBase: base.seasonBase,
    settings: `${base.seasonBase}/settings`,
    koc2db: 'KOC2DB',
    season1: 'KOC2DBPONEW'
  };

  CLUB_COLLECTIONS.forEach(name => { paths[name] = `${base.clubBase}/${name}`; });
  SEASON_COLLECTIONS.forEach(name => { paths[name] = `${base.seasonBase}/${name}`; });
  return paths;
}

export function buildMigrationPlan(scope = DEFAULT_SEASON_SCOPE) {
  const target = buildTenantPaths(scope);
  return Object.entries(LEGACY_PATHS).map(([key, from]) => ({
    key,
    from,
    to: target[key],
    strategy: key === 'admin' || key === 'adminUsers' ? 'copy-once-club-scope' : 'copy-season-data',
    verify: `Compare counts/checksum for ${from} and ${target[key]}`
  }));
}

export function withTenantMetadata(record = {}, scope = DEFAULT_SEASON_SCOPE) {
  const base = buildTenantBase(scope);
  return {
    ...record,
    clubId: record.clubId || base.clubId,
    seasonId: record.seasonId || base.seasonId
  };
}

export const PATHS = buildTenantPaths(DEFAULT_SEASON_SCOPE);
