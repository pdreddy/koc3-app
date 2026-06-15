# KOC Season 2 — Mobile PWA (PRD)

## Original Problem Statement
Convert https://github.com/pdreddy/koc-season-2.git (static HTML + Firebase RTDB tennis tournament app) into a mobile PWA. Keep Firebase as backend (no Python). Add admin password, 16 teams with per-team passwords for score entry, and validate player names from existing rosters during scoring with fuzzy-match suggestions for mismatches.

## Architecture
- **Frontend**: React 18 + React Router v6 (CRA) as a mobile-first PWA
- **Backend**: Firebase Realtime Database (project `koc2-20fb8`) — direct client access at path `koc_s2/*`. A minimal FastAPI stub at `/app/backend/server.py` exists only to satisfy supervisor (returns `/api/health`); no business logic.
- **Service Worker / Manifest**: `public/sw.js` + `public/manifest.json` provide installability ("Add to Home Screen") on iOS/Android.
- **Auth**: Two-role local password auth stored in Firebase (`admin.password` + each `team.password`). Sessions persisted in `localStorage` (`koc_session_v1`).

## User Personas
1. **Guest** — Reads-only: Teams, Standings, Matches, Rules.
2. **Team Captain** — Logs in with team password; can enter scores for matches involving their own team.
3. **Admin** — Logs in with admin password; can manage teams (name/abbr/password/players/captain), change admin password, view all team passwords, delete individual matches or clear all results.

## Core Requirements (static)
- 16 teams, 7 players each (1 captain + 6 players).
- Score entry: 1 Singles + 2 Doubles courts; best-of-3 sets each; first-to-4 games per set; 10-pt tiebreak on 3-3.
- Player name fuzzy matching: exact ✓ (green), suggestions when similarity ≥ 0.45, auto-match at ≥ 0.92, ✗ when no candidates.
- Standings sort: Match Pts → Set Diff → Sets Won → Game Diff → Games Won.
- Top 4 highlighted as qualified.

## Implemented (2026-01)
- [x] React PWA scaffolding (CRA + service worker + manifest + iOS/Android icons)
- [x] Firebase RTDB integration with anonymous auth bootstrap + group-field migration
- [x] Auto-seeding of 16 teams split into Group A / Group B (8 each) + admin password on first run
- [x] Public pages: Teams (grouped), Standings (two group tables), Schedule, Matchups, Match History, Rules, More
- [x] Login page with Team/Admin tabs + guest browse
- [x] Score Entry with TWO modes:
  - **Form** — guided court-by-court entry with PlayerInput live fuzzy match (✓/✗ + suggestion dropdown)
  - **⚡ Quick Paste** — legacy text-paste parser (e.g., `SK vs RR\nS: Kanak vs Yogesh 4-0,4-1,4-1 (won) SK`) with auto-correct on near-matches and per-line preview
- [x] Validation prevents save when any player name doesn't match team roster (both modes); aggregated error messages
- [x] Admin dashboard: Teams editor (rename/abbr/group/players/captain/password), Settings (admin password + clear-all-matches), Passwords (visible list of all 16 team passwords)
- [x] Match deletion & clear-all (admin only)
- [x] Group A / Group B split:
  - Teams page sections by group
  - Standings page renders two separate tables (top-2 of each group qualify for semifinals)
  - Admin can move a team between groups
  - Intra-group matches only count toward that group's standings
- [x] Mobile-first layout: sticky header, fixed 5-tab bottom-nav, safe-area-inset support
- [x] localStorage session persistence
- [x] Schedule page (9-week round-robin + Thanksgiving break + Playoffs) with team filter
- [x] Matchups page (Player Stats / Singles Cap / Doubles partnerships) with caps tracking
- [x] Tested 79/80 end-to-end scenarios across three testing iterations (1 flaky timing test self-verified manually)

## Backlog / Future (P1/P2)
- P2: Store team IDs (not just names) in match records so that renaming a team after matches were played doesn't break historical standings.
- P2: Move Schedule into Firebase so admin can edit fixtures and rebuild fixtures for the Group A / Group B split (current schedule is the legacy 9-team round-robin).
- P2: Tighten Firebase RTDB security rules + working anonymous auth (preview container blocks `identitytoolkit.googleapis.com`, but RTDB writes succeed because rules are open).
- P3: Refactor 556-line ScoreEntry.js into Form + QuickEntry separate modules.
- P3: Per-court ❌ annotation in Quick Paste preview when only some lines have name errors.
- P2: Session TTL for shared captain devices.
- P2: Hash team/admin passwords (currently plaintext in RTDB).
- P2: Push notifications for new results.
- P2: CSV export of standings / per-team stats.

## Test Credentials
See `/app/memory/test_credentials.md`. Admin: `KOCPO#ADMIN`. Team pattern: `KOC<ABBR>#2` (e.g., SK → `KOCSK#2`).

## Files / Structure
```
/app/frontend/        React PWA (yarn start on port 3000)
  src/firebase.js     Firebase config + RTDB paths
  src/data/initialTeams.js   Seed: 9 real teams + 7 placeholders
  src/utils/nameMatch.js     Levenshtein-based fuzzy matcher
  src/contexts/AuthContext.js  localStorage session
  src/pages/{Teams,Standings,History,Rules,Login,Admin,ScoreEntry}.js
  src/components/{Header,BottomNav}.js
/app/backend/         FastAPI stub (no business logic)
/app/legacy/          Original static HTML files (for reference)
```
