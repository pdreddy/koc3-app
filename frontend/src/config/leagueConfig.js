// LeagueConfig: the target shape for making league rules configurable per club/season.
// Captures KOC's current values verbatim as the default, so every dimension here is
// byte-for-byte equivalent to today's behavior until a club opts into something different.
//
// Wiring status (see memory/MULTI_CLUB_SAAS_PLAN.md for the full phased plan):
//  - standings.tiebreakOrder / playoffs.qualifyPerGroup / structure.groupCount|teamsPerGroup
//    ARE consumed by pages/Standings.js.
//  - matchFormat IS consumed by utils/tennisScoreRules.js (validateLineScore, etc.) when a
//    caller explicitly passes it; ScoreEntry.js and ScoreProcessingService.js still call
//    those functions without a format argument, so they use DEFAULT_MATCH_FORMAT — wiring
//    those call sites to a resolved per-club config is a later, separately-verified step.
//  - scheduling.* documents the shape consumed by utils/roundRobin.js's
//    buildScheduleFromGroups(); buildScheduleFor8x2 (KOC's actual seeding path) still
//    supplies these as literals rather than reading this object.
//  - lineupSlots is NOT wired anywhere. The real match-day format is 1 singles line + a
//    4-line doubles "cross-pairing" round robin between each team's two doubles pairs
//    (see pages/ScoreEntry.js COURT_TEMPLATES / buildLineupCourts) — a more specific
//    tournament-format concept than a flat line list, and it's validated in three places
//    that must move together (ScoreEntry.js, quickScoreParser.js, and the lineup-lock
//    Cloud Function in functions/index.js, which can't be verified outside a deploy).
//    Generalizing it is intentionally deferred to its own phase rather than guessed at here.
//  - eligibility is already config-driven at runtime via settings.eligibilityRules in RTDB
//    (see utils/eligibilityRules.js) — these are just the same fallback defaults mirrored
//    here for visibility.
//  - branding, playoffs.type are not wired into any component yet.

import { DEFAULT_MATCH_FORMAT } from '../utils/tennisScoreRules';

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

  // Set/game/tiebreak scoring rules — see utils/tennisScoreRules.js DEFAULT_MATCH_FORMAT
  // (this is a re-export, not a duplicate, so the two can't drift apart).
  matchFormat: DEFAULT_MATCH_FORMAT,

  // Pre-match lineup submission slots (validated by the Cloud Function before lineups are
  // revealed). NOT wired anywhere yet — see the file header note above.
  lineupSlots: [
    { code: 'S1', label: 'Singles', playersNeeded: 1 },
    { code: 'D1', label: 'Doubles 1', playersNeeded: 2 },
    { code: 'D2', label: 'Doubles 2', playersNeeded: 2 },
  ],

  // Points / standings — order matches the tiebreak chain on the live Standings page
  // exactly (see utils/standingsRanking.js DEFAULT_TIEBREAK_ORDER). Note: the standings
  // persisted by ScoreProcessingService.computeStandings() use a slightly different,
  // legacy order and aren't read by any page today — reconciling that is out of scope
  // for this phase (see memory/MULTI_CLUB_SAAS_PLAN.md).
  standings: {
    pointsPerWin: 1,
    tiebreakOrder: ['points', 'setsFor', 'gamesFor', 'singlesWins', 'headToHead', 'setDiff', 'gameDiff', 'teamName'],
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
