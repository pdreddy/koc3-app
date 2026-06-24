export const DEFAULT_LEAGUE_CONFIG = {
  leagueName: 'KOC Season 3',
  clubName: 'KOC Tennis Club',
  sportName: 'Tennis',
  ratingSystemName: 'UTR',
  seasonLabel: 'Season 3',
  gameStyle: 'Round Robin + Playoffs',
  teamCount: 16,
  groupsCount: 2,
  minPlayersPerTeam: 7,
  maxPlayersPerTeam: 9,
  activePlayersPerMatch: 5,
  linesPerMatch: 5,
  playoffQualifiersPerGroup: 4,
  singlesLines: 1,
  doublesLines: 4,
  regularSeasonStart: '2026-06-30',
  regularSeasonEnd: '2026-09-15',
  primaryMatchDays: 'Saturday & Sunday',
  scoreReportingDeadline: 'Sunday morning',
  lineupDeadline: '9:00 PM on match day',
  allowWeekdayReschedules: true,
  commercialMode: true
};

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toText(value, fallback) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function normalizeLeagueConfig(config = {}) {
  const base = { ...DEFAULT_LEAGUE_CONFIG, ...(config || {}) };
  const minPlayers = toPositiveInt(base.minPlayersPerTeam, DEFAULT_LEAGUE_CONFIG.minPlayersPerTeam);
  const maxPlayers = Math.max(minPlayers, toPositiveInt(base.maxPlayersPerTeam, DEFAULT_LEAGUE_CONFIG.maxPlayersPerTeam));
  const activePlayers = Math.min(maxPlayers, toPositiveInt(base.activePlayersPerMatch, DEFAULT_LEAGUE_CONFIG.activePlayersPerMatch));
  const lines = toPositiveInt(base.linesPerMatch, DEFAULT_LEAGUE_CONFIG.linesPerMatch);
  const singles = Math.min(lines, toPositiveInt(base.singlesLines, DEFAULT_LEAGUE_CONFIG.singlesLines));
  const doubles = Math.max(0, lines - singles);

  return {
    leagueName: toText(base.leagueName, DEFAULT_LEAGUE_CONFIG.leagueName),
    clubName: toText(base.clubName, DEFAULT_LEAGUE_CONFIG.clubName),
    sportName: toText(base.sportName, DEFAULT_LEAGUE_CONFIG.sportName),
    ratingSystemName: toText(base.ratingSystemName, DEFAULT_LEAGUE_CONFIG.ratingSystemName),
    seasonLabel: toText(base.seasonLabel, DEFAULT_LEAGUE_CONFIG.seasonLabel),
    gameStyle: toText(base.gameStyle, DEFAULT_LEAGUE_CONFIG.gameStyle),
    teamCount: toPositiveInt(base.teamCount, DEFAULT_LEAGUE_CONFIG.teamCount),
    groupsCount: toPositiveInt(base.groupsCount, DEFAULT_LEAGUE_CONFIG.groupsCount),
    minPlayersPerTeam: minPlayers,
    maxPlayersPerTeam: maxPlayers,
    activePlayersPerMatch: activePlayers,
    linesPerMatch: lines,
    playoffQualifiersPerGroup: toPositiveInt(base.playoffQualifiersPerGroup, DEFAULT_LEAGUE_CONFIG.playoffQualifiersPerGroup),
    singlesLines: singles,
    doublesLines: toPositiveInt(base.doublesLines, doubles) || doubles,
    regularSeasonStart: toText(base.regularSeasonStart, DEFAULT_LEAGUE_CONFIG.regularSeasonStart),
    regularSeasonEnd: toText(base.regularSeasonEnd, DEFAULT_LEAGUE_CONFIG.regularSeasonEnd),
    primaryMatchDays: toText(base.primaryMatchDays, DEFAULT_LEAGUE_CONFIG.primaryMatchDays),
    scoreReportingDeadline: toText(base.scoreReportingDeadline, DEFAULT_LEAGUE_CONFIG.scoreReportingDeadline),
    lineupDeadline: toText(base.lineupDeadline, DEFAULT_LEAGUE_CONFIG.lineupDeadline),
    allowWeekdayReschedules: !!base.allowWeekdayReschedules,
    commercialMode: base.commercialMode !== false
  };
}

export const DEFAULT_SCORING_CONFIG = {
  winPoints: 1,
  lossPoints: 0,
  forfeitPoints: 0,
  requireMajorityLines: true,
  validateRosterNames: true,
  enforceEligibility: true,
  templates: [
    { id: 'singles-1', label: 'Singles', type: 'singles', playersPerSide: 1, setCount: 5, gamesPerSet: 4, noAd: true, tiebreakAt: 3, tiebreakPoints: 7 },
    { id: 'doubles-1', label: 'Doubles 1', type: 'doubles', playersPerSide: 2, setCount: 3, gamesPerSet: 4, noAd: true, tiebreakAt: 3, tiebreakPoints: 7 },
    { id: 'doubles-1-rev', label: 'Doubles 1 Reverse', type: 'doubles', playersPerSide: 2, setCount: 3, gamesPerSet: 4, noAd: true, tiebreakAt: 3, tiebreakPoints: 7 },
    { id: 'doubles-2', label: 'Doubles 2', type: 'doubles', playersPerSide: 2, setCount: 3, gamesPerSet: 4, noAd: true, tiebreakAt: 3, tiebreakPoints: 7 },
    { id: 'doubles-2-rev', label: 'Doubles 2 Reverse', type: 'doubles', playersPerSide: 2, setCount: 3, gamesPerSet: 4, noAd: true, tiebreakAt: 3, tiebreakPoints: 7 }
  ]
};

export const DEFAULT_SEASON_SCOPE = {
  clubId: 'koc',
  clubName: 'KOC Tennis Club',
  seasonId: 'koc_s3',
  seasonName: 'KOC Season 3',
  archiveHistoricalSeasons: true
};

export const DEFAULT_PLAYER_PROFILE_CONFIG = {
  enabled: true,
  requireVerifiedPlayers: false,
  trackAvailability: true,
  showRatingTrend: true,
  rankingMetric: 'PTL Rating',
  ratingHistoryWindow: 10
};

export const DEFAULT_SCHEDULE_CONFIG = {
  format: 'roundRobin',
  autoSchedulerEnabled: true,
  courtCount: 4,
  slotDurationMinutes: 90,
  defaultStartTime: '9:00 AM',
  primaryDays: ['Saturday', 'Sunday'],
  blackoutDates: ['2026-07-04'],
  allowManualFixtures: true
};

function normalizeTemplate(template, index) {
  const type = template?.type === 'singles' ? 'singles' : 'doubles';
  return {
    id: toText(template?.id, `${type}-${index + 1}`),
    label: toText(template?.label, `${type === 'singles' ? 'Singles' : 'Doubles'} ${index + 1}`),
    type,
    playersPerSide: type === 'singles' ? 1 : 2,
    setCount: toPositiveInt(template?.setCount, type === 'singles' ? 5 : 3),
    gamesPerSet: toPositiveInt(template?.gamesPerSet, 4),
    noAd: !!template?.noAd,
    tiebreakAt: toPositiveInt(template?.tiebreakAt, 3),
    tiebreakPoints: toPositiveInt(template?.tiebreakPoints, 7)
  };
}

export function normalizeScoringConfig(config = {}) {
  const base = { ...DEFAULT_SCORING_CONFIG, ...(config || {}) };
  const templates = Array.isArray(base.templates) && base.templates.length > 0 ? base.templates : DEFAULT_SCORING_CONFIG.templates;
  return {
    winPoints: toPositiveInt(base.winPoints, DEFAULT_SCORING_CONFIG.winPoints),
    lossPoints: Number.isFinite(Number(base.lossPoints)) ? Number(base.lossPoints) : DEFAULT_SCORING_CONFIG.lossPoints,
    forfeitPoints: Number.isFinite(Number(base.forfeitPoints)) ? Number(base.forfeitPoints) : DEFAULT_SCORING_CONFIG.forfeitPoints,
    noAd: !!base.noAd,
    gamesPerSet: toPositiveInt(base.gamesPerSet, 4),
    requireMajorityLines: base.requireMajorityLines !== false,
    validateRosterNames: base.validateRosterNames !== false,
    enforceEligibility: base.enforceEligibility !== false,
    templates: templates.map(normalizeTemplate)
  };
}

export function normalizeSeasonScope(config = {}) {
  const base = { ...DEFAULT_SEASON_SCOPE, ...(config || {}) };
  return {
    clubId: keyForScope(toText(base.clubId, DEFAULT_SEASON_SCOPE.clubId)),
    clubName: toText(base.clubName, DEFAULT_SEASON_SCOPE.clubName),
    seasonId: keyForScope(toText(base.seasonId, DEFAULT_SEASON_SCOPE.seasonId)),
    seasonName: toText(base.seasonName, DEFAULT_SEASON_SCOPE.seasonName),
    archiveHistoricalSeasons: base.archiveHistoricalSeasons !== false
  };
}

export function normalizePlayerProfileConfig(config = {}) {
  const base = { ...DEFAULT_PLAYER_PROFILE_CONFIG, ...(config || {}) };
  return {
    enabled: base.enabled !== false,
    requireVerifiedPlayers: !!base.requireVerifiedPlayers,
    trackAvailability: base.trackAvailability !== false,
    showRatingTrend: base.showRatingTrend !== false,
    rankingMetric: toText(base.rankingMetric, DEFAULT_PLAYER_PROFILE_CONFIG.rankingMetric),
    ratingHistoryWindow: toPositiveInt(base.ratingHistoryWindow, DEFAULT_PLAYER_PROFILE_CONFIG.ratingHistoryWindow)
  };
}

export function normalizeScheduleConfig(config = {}) {
  const base = { ...DEFAULT_SCHEDULE_CONFIG, ...(config || {}) };
  const primaryDays = Array.isArray(base.primaryDays) ? base.primaryDays : String(base.primaryDays || '').split(',');
  const blackoutDates = Array.isArray(base.blackoutDates) ? base.blackoutDates : String(base.blackoutDates || '').split(',');
  return {
    format: toText(base.format, DEFAULT_SCHEDULE_CONFIG.format),
    autoSchedulerEnabled: base.autoSchedulerEnabled !== false,
    courtCount: toPositiveInt(base.courtCount, DEFAULT_SCHEDULE_CONFIG.courtCount),
    slotDurationMinutes: toPositiveInt(base.slotDurationMinutes, DEFAULT_SCHEDULE_CONFIG.slotDurationMinutes),
    defaultStartTime: toText(base.defaultStartTime, DEFAULT_SCHEDULE_CONFIG.defaultStartTime),
    primaryDays: primaryDays.map(day => String(day || '').trim()).filter(Boolean),
    blackoutDates: blackoutDates.map(date => String(date || '').trim()).filter(Boolean),
    allowManualFixtures: base.allowManualFixtures !== false
  };
}

function keyForScope(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'default';
}
