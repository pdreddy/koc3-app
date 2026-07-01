export const DEFAULT_TOURNAMENT_ID = 'koc-season-3';
export const PLATFORM_ROOT = 'platform/tournaments';

export const TOURNAMENT_COLLECTIONS = [
  'config', 'settings', 'permissions', 'branding', 'registration', 'players',
  'teams', 'captains', 'groups', 'schedules', 'matches', 'lineups', 'scores',
  'standings', 'rankings', 'playoffs', 'statistics', 'rules', 'announcements',
  'gallery', 'sponsors', 'documents', 'notifications', 'history', 'auditLogs'
];

export const DEFAULT_TOURNAMENT_CONFIG = {
  id: DEFAULT_TOURNAMENT_ID,
  name: 'KOC Season 3',
  shortName: 'KOC3',
  season: 'Season 3',
  clubName: 'KOC',
  leagueName: 'KOC League',
  type: 'koc-league',
  status: 'published',
  structure: {
    numberOfGroups: 2,
    numberOfTeams: 16,
    playersPerTeam: 12,
    captainRequired: true,
    viceCaptain: true
  },
  matchTypes: [
    { id: 'doubles', label: 'Doubles', enabled: true, lines: 3 },
    { id: 'reverse-doubles', label: 'Reverse Doubles', enabled: true, lines: 3 }
  ],
  scoring: {
    format: 'best-of-3',
    decidingPoint: 'advantage',
    allowWalkover: true,
    allowRetired: true,
    allowIncomplete: true
  },
  standings: {
    priority: ['wins', 'points', 'setPercentage', 'gamePercentage', 'headToHead']
  },
  visibility: {
    home: 'public',
    schedule: 'public',
    standings: 'public',
    gallery: 'public',
    rules: 'public',
    announcements: 'public',
    playerProfiles: 'login',
    captainDashboard: 'captain',
    scoreEntry: 'captain',
    adminDashboard: 'admin',
    playerImport: 'admin',
    tournamentSettings: 'admin'
  }
};
