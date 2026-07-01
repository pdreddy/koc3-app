# Tournament Platform v2

A ground-up rewrite (React + TypeScript + Material UI + Firebase **Firestore**) implementing
the "unlimited clubs and tournaments on one codebase" platform vision. This is intentionally
**not** an extension of `../frontend` (the live KOC app, which stays on plain JS + Firebase
**Realtime Database** and is not touched by anything in this directory) — see the chat
history / `memory/MULTI_CLUB_SAAS_PLAN.md` for why those two goals conflict and were split
into separate efforts.

## Status: early scaffold, not yet usable end-to-end

What works today (typechecked + built successfully, **not yet run against a real Firebase
project or manually tested in a browser**):

- Data model: `src/types/` — full `TournamentConfig` covering wizard steps 1, 3, 5-10 from
  the spec (info, structure, match types, scoring, standings, playoffs, registration,
  visibility, branding). Steps 2 and 4 (type picker, player eligibility config) also modeled.
- `TournamentRepository` (`src/services/TournamentRepository.ts`): generic, tournament-scoped
  Firestore CRUD — every read/write is automatically rooted at
  `platform/tournaments/{tournamentId}/{collection}`. No call site anywhere hand-writes a
  Firestore path.
- `TournamentService` (`src/services/TournamentService.ts`): top-level tournament CRUD
  (create/list/get/publish/archive/duplicate; delete removes the tournament doc only —
  subcollection cleanup is intentionally not implemented client-side, see the code comment).
- `TournamentContext` / `useTournament()`: resolves the active tournament by id or slug.
- Admin UI: Tournament Manager (list/create/publish/archive/duplicate/delete) and a
  Create Tournament wizard covering **Steps 1-3 only** (info, type, structure) — Steps 4-10
  get sane defaults from `buildDefaultTournamentConfig()` and are editable later once a
  settings screen exists.
- `firestore.rules`: skeleton enforcing tournament isolation via a same-subtree
  `permissions/{uid}` document instead of Firebase Auth custom claims (deliberately —
  see the file's header comment for why). **Not deployed. Platform-wide SUPER_ADMIN is a
  TODO, not implemented** — `isSuperAdmin()` currently always returns `false`.

## What's NOT built yet

- Roster import (CSV/JSON), team/group/schedule generators, the public `/t/:slug` site,
  and real per-page visibility enforcement (the `visibility` config exists in the data
  model but nothing reads it to guard a route yet — today only "signed in or not" is
  checked, in `App.tsx`'s `RequireAuth`).
- Any manual/browser testing. `npm run build` passing is necessary but not sufficient —
  nobody has clicked through this in a real browser against a real Firestore project yet.

## Setup

```bash
cd platform-v2
npm install
cp .env.example .env.local   # fill in a Firestore-enabled Firebase project's config —
                              # do NOT point this at koc2-20fb8 (the live RTDB project)
npm run dev                  # http://localhost:5173
```

You'll also need, in the Firebase project you point `.env.local` at:
- Firestore enabled (Native mode)
- Authentication → Email/Password provider enabled, with at least one user created (there's
  no self-serve admin signup screen yet — create the first admin user directly in the
  Firebase console)
- `firestore.rules` deployed (`firebase deploy --only firestore:rules` from a machine with
  the Firebase CLI and credentials for that project — not available in the session that
  wrote this)

## Commands

```bash
npm run dev         # dev server
npm run typecheck   # tsc --noEmit
npm run build        # typecheck + production build
npm run preview      # serve the production build locally
```
