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
//  - matchStructure IS consumed by pages/ScoreEntry.js (COURT_TEMPLATES, buildLineupCourts,
//    LINEUP_ROLE_SLOTS all derive from utils/matchStructure.js with the default structure)
//    — this covers the post-reveal *scoring* side. The pre-match *lineup submission* UI
//    (pages/Home.js buildDashboardLineupLines) and the lineup-lock Cloud Function
//    (functions/index.js) still hardcode the S1/D1/D2 shape rather than reading this —
//    that half needs a real Firebase deploy to verify and is deferred to its own phase.
//    Because DEFAULT_MATCH_STRUCTURE reproduces that same S1/D1/D2 5-slot shape, the two
//    stay compatible as long as a club uses the default structure.
//  - lineupSlots below documents the pre-match submission shape (NOT wired anywhere —
//    Home.js and the Cloud Function still hardcode it, per the note above).
//  - eligibility is already config-driven at runtime via settings.eligibilityRules in RTDB
//    (see utils/eligibilityRules.js) — these are just the same fallback defaults mirrored
//    here for visibility.
//  - branding, playoffs.type are not wired into any component yet.

import { DEFAULT_MATCH_FORMAT } from '../utils/tennisScoreRules';
import { DEFAULT_MATCH_STRUCTURE } from '../utils/matchStructure';

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

  // Match-day line structure (singles/doubles line count and cross-pairing) — see
  // utils/matchStructure.js DEFAULT_MATCH_STRUCTURE (re-export, not a duplicate).
  matchStructure: DEFAULT_MATCH_STRUCTURE,

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
