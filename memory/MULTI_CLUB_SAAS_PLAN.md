# KOC → Multi-Club SaaS: Architecture & Migration Plan

## 1. Current State Summary

Single-tenant React 18 + Firebase RTDB PWA. One club (KOC), one season (`s3`), everything
hardcoded for that season. Stack: Vite + React Router + Zustand (frontend), Firebase RTDB
(data), Firebase Cloud Functions (lineup reveal), FastAPI stub (unused, satisfies a legacy
supervisor check only).

Verified baseline before any change (2026-07-01): `npm install`, `npm test` (7/8 suites green;
`ScoreEntry.test.js` fails only because CRA's Jest can't parse Vite's `import.meta.env` — a
pre-existing, unrelated issue), `npm run build` — all pass.

## 2. Hardcoded KOC Assumptions (catalog)

| Area | Where | What's hardcoded | Difficulty to lift |
|---|---|---|---|
| DB root | `firebasePaths.js:1` | `CURRENT_SEASON_ROOT='koc_s3'` — every path derives from this single string | Easy (path is already centralized) |
| Firebase project | `firebaseConfig.js` | Single hardcoded project/DB, env-overridable | Easy (already env-var ready) |
| Teams/groups | `data/auctionTeams.js` | 16 named teams, hand-assigned to Group A/B (8+8), real auction data | Easy (seed data) but wide blast radius since components assume "2 groups of 8" |
| Schedule | `utils/roundRobin.js` | `buildScheduleFor8x2()` hardcodes 8-team round robin twice, fixed 2026 calendar dates, `'7:15 PM'` slot | Moderate (needs generalized N-group generator) |
| Lineup/court format | `functions/index.js`, `quickScoreParser.js` | Exactly 1 Singles (S1) + 2 Doubles (D1/D2) = 5 slots | Hard — validated in 3 places (client, ScoreProcessingService, Cloud Function) |
| Scoring format | `utils/tennisScoreRules.js` | 4-game sets, singles best-of-3, doubles best-of-2+10pt match tiebreak, 7pt set tiebreak | Hard — encoded as literal comparisons, not data |
| Standings ranking | `Standings.js`, `ScoreProcessingService.js` | Fixed tiebreak chain (Pts→Sets→Singles Wins→H2H→Game Diff→Name); "top 4 qualify" | Moderate — two independent implementations of the same sort (duplication bug risk) |
| Eligibility rules | `utils/eligibilityRules.js` | Defaults hardcoded, but **already overridable** via `settings.eligibilityRules` in RTDB | Already solved — good pattern to copy |
| Roles/permissions | `utils/roles.js` | Fixed 4-role model, global functions, no club scoping | Moderate |
| Security rules | `database.rules.json` | All rules nested under literal `"koc_s3"` key; auth custom claims (`superAdmin`, `teamId`, `server`) have no `clubId` | Hard — needs per-club claim + rule design |
| Branding | `Header.js`, `manifest.json`, `firebaseConfig.js` | KOC3 name/logo hardcoded in JSX and static manifest | Easy |
| Admin defaults | `data/initialTeams.js`, `Login.js` | 3 named admins, fixed password/PINs | Easy (seed data) |

Full raw catalog is preserved in this session's research; the table above is the actionable
summary. Two **critical blockers** for true multi-tenancy: (1) all data lives under one literal
DB path with rules to match, (2) auth tokens carry no `clubId`.

## 3. Target Architecture

**Principle: add a tenant layer *above* the existing data, don't move the existing data.**

```
clubs/{clubId}                      → club registry: name, branding, dataRoot, status
leagueConfigs/{clubId}/{seasonId}   → configurable league rules (see schema below)
koc_s3/...                          → UNCHANGED. KOC's dataRoot stays exactly here.
clubs/{newClubId}/s1/...            → new clubs get their own isolated dataRoot
```

- `clubs.koc = { id: 'koc', dataRoot: 'koc_s3', ... }` — the existing production data becomes
  "the club whose data happens to live at `koc_s3`". No documents move. No downtime.
- `firebasePaths.js` becomes a **factory** `buildPaths(dataRoot)`. The existing `PATHS` export
  is `buildPaths('koc_s3')` — byte-identical values to today, so every one of the ~8 files that
  `import { PATHS }` needs zero changes in this phase.
- A `LeagueConfig` document (per club+season) captures the dimensions in the "What I want" list
  (team/group counts, lines, scoring format, playoff structure, points, tiebreak order,
  eligibility, scheduling, branding). KOC's config is seeded with today's values verbatim —
  config exists, but nothing reads from it yet in this phase, so behavior is unchanged.
- Business logic (`roundRobin`, `tennisScoreRules`, standings comparator, eligibility, lineup
  slot validation) gets refactored **in later phases** to read from `LeagueConfig` instead of
  literals, one module at a time, each verified against KOC's config (which must reproduce
  today's exact output) before any other club can safely opt into different values.
- Roles gain an optional `clubId` scope; existing sessions without one keep behaving as global
  KOC roles (backward compatible).
- Security rules: add new `clubs` / `leagueConfigs` top-level rule blocks; leave the existing
  `koc_s3` block untouched. New clubs' data roots get their own rule blocks (or a rules-2.0
  wildcard scoped by custom claim) added when the second club onboards — not needed for KOC.

## 4. Phased, Zero-Downtime Migration Plan

Each phase must build, pass tests, and preserve KOC behavior before starting the next.

- **Phase 1 (this session):** Add the tenant scaffold — club registry, `LeagueConfig` schema
  populated with KOC's current values, `buildPaths()` factory, `ClubContext`. Purely additive:
  no existing file's runtime behavior changes. This is the seam everything else plugs into.
- **Phase 2:** Wire read-only consumers to config without changing values — e.g. Standings page
  reads "qualify top N" and tiebreak order from `LeagueConfig` instead of literals, defaulting
  to identical KOC values. Verify standings output is byte-identical for existing match data.
- **Phase 3:** Generalize `roundRobin`/schedule builder to N groups × M teams, driven by config;
  regenerate KOC's schedule from config and diff against the existing hardcoded schedule to
  confirm equivalence before switching.
- **Phase 4:** Generalize match/lineup format (line count, singles/doubles mix, scoring rules,
  tiebreak thresholds) in `tennisScoreRules.js`, `ScoreProcessingService.js`, quick-score parser,
  and the Cloud Function validator together (they must stay in sync) — highest risk phase,
  needs the most careful verification against real match data.
- **Phase 5:** Club-scoped auth (custom claims with `clubId`), club-scoped security rules,
  club onboarding admin flow (create club → seed default config → invite admin).
- **Phase 6:** Branding/theming per club (logo, colors, sponsor slots), multi-club navigation
  (club picker / subdomain routing).

## 5. What Ships in This Session

Phase 1 only, per the "small, safe, incremental" instruction: club registry + `LeagueConfig`
schema (documenting, not yet driving, today's rules) + `buildPaths()` factory + `ClubContext`
scaffold + additive security-rule stubs. No page, service, or business-logic file's behavior
changes. Verified via existing build + test suite before and after.

Phases 2–6 are substantial, independent efforts (each touches shared, high-risk business logic)
and should be taken up as their own reviewed increments rather than rushed into one session.
