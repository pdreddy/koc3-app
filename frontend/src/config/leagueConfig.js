// LeagueConfig: the target shape for making league rules configurable per club/season.
//
// Phase 1 status: this module defines the schema and captures KOC's *current* hardcoded
// values verbatim, so a config document exists and is byte-for-byte equivalent to today's
// behavior. Nothing reads from this yet — roundRobin.js, tennisScoreRules.js,
// ScoreProcessingService.js and Standings.js still use their own literals. Wiring each of
// those to read from LeagueConfig (while proving output stays identical for KOC) is later,
// separately-verified work — see memory/MULTI_CLUB_SAAS_PLAN.md phases 2-4.
//
// Until a module is migrated, treat this as documentation of "what KOC's implicit config
// would be" rather than an active source of truth.

export const DEFAULT_LEAGUE_CONFIG = {
  season: {
    id: 's3',
    name: 'KOC Season 3',
  },

  // Team & group structure
  structure: {
    groupCount: 2,
    teamsPerGroup: 8,
    playersPerTeam: 7,
    groupLabels: ['A', 'B'],
  },

  // Lineup / court format: one entry per scored line in a match day
  lines: [
    { code: 'S1', type: 'singles', setFormat: '4-game', bestOfSets: 3, setTiebreak: { minPoints: 7, winBy: 2 } },
    { code: 'D1', type: 'doubles', setFormat: '4-game', bestOfSets: 2, setTiebreak: { minPoints: 7, winBy: 2 }, matchTiebreak: { minPoints: 10, winBy: 2 } },
    { code: 'D2', type: 'doubles', setFormat: '4-game', bestOfSets: 2, setTiebreak: { minPoints: 7, winBy: 2 }, matchTiebreak: { minPoints: 10, winBy: 2 } },
  ],

  // Points / standings
  standings: {
    pointsPerWin: 1,
    tiebreakOrder: ['points', 'setsWon', 'singlesWins', 'headToHead', 'gameDiff', 'teamName'],
  },

  // Playoff structure
  playoffs: {
    type: 'group-then-knockout',
    qualifyPerGroup: 4,
  },

  // Player eligibility (this dimension is already config-driven at runtime via
  // settings.eligibilityRules in RTDB — see utils/eligibilityRules.js — these are just
  // the fallback defaults, kept here so the full rule surface is visible in one place)
  eligibility: {
    maxSinglesDays: 2,
    maxTotalMatchDays: 6,
    maxPartnerDays: 3,
    doublesPlayersMustPlayBothLines: true,
  },

  // Scheduling
  scheduling: {
    matchDayOfWeek: { A: 'Saturday', B: 'Sunday' },
    matchTime: '7:15 PM',
    roundsPerGroup: 7,
  },

  // Branding — see config/clubs.js for the per-club values; this mirrors the shape
  // expected once branding is read from LeagueConfig instead of hardcoded JSX.
  branding: {
    appName: 'KOC3 / PPRC Tennis',
    shortName: 'KOC3',
    themeColor: '#2563eb',
  },
};

export function getLeagueConfig(_clubId, _seasonId) {
  // Phase 1: every club resolves to KOC's default config; per-club overrides
  // (fetched from RTDB `leagueConfigs/{clubId}/{seasonId}`) land in a later phase.
  return DEFAULT_LEAGUE_CONFIG;
}
