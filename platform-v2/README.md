# Tournament Platform v2

A ground-up rewrite (React + TypeScript + Material UI + Firebase **Firestore**) implementing
the "unlimited clubs and tournaments on one codebase" platform vision. This is intentionally
**not** an extension of `../frontend` (the live KOC app, which stays on plain JS + Firebase
**Realtime Database** and is not touched by anything in this directory) — see
`memory/MULTI_CLUB_SAAS_PLAN.md` for why those two goals conflict and were split into
separate efforts.

## Status: full create-to-publish flow implemented, not yet manually tested

Typechecks and builds clean (`npm run build`). **Nobody has run this in a browser against a
real Firebase project yet** — that needs a Firestore-enabled project and credentials that
don't exist in the session that wrote this. Treat everything below as "should work" pending
that first real test pass, not "verified working."

### What's implemented

- **Data model** (`src/types/`): full `TournamentConfig` covering wizard steps 1, 3, 5-10
  from the spec (info, structure, match types, scoring, standings, playoffs, registration,
  per-page visibility, branding).
- **Tournament-scoped data access**: `TournamentScopedRepository` roots every read/write at
  `platform/tournaments/{tournamentId}/{collection}` — no hand-written Firestore path
  anywhere. `TournamentService` handles tournament-level CRUD (create/list/publish/
  archive/duplicate/delete).
- **Admin flow**: sign in → Tournament Manager → Create Tournament wizard (Steps 1-3: info,
  type, structure; steps 4-10 get defaults, not yet individually editable after creation) →
  tournament detail page → **Import Players** (CSV or JSON upload, column mapping,
  duplicate detection) → **Generate Teams** (random or UTR-balanced snake draft, split
  across the configured group count) → **Generate Schedule** (round-robin per group,
  configurable start date/time) → **Publish**.
- **Public site** (`/t/{slug}`): Home, Schedule, Standings (computed client-side from
  matches via `src/services/standingsEngine.ts`, driven by `config.standings.tiebreakOrder`
  — same design as the koc3-app PR's `standingsRanking.js`), Teams, Rules.
- **Per-page visibility**: `VisibilityGate` reads `tournament.config.visibility[pageId]` and
  the signed-in user's resolved per-tournament role (`useTournamentRole`, backed by a
  `permissions/{uid}` doc) to decide render vs. a locked message. **This is a UI convenience
  only** — `firestore.rules` is the actual security boundary.
- **`firestore.rules`**: tournament isolation via same-subtree `permissions/{uid}` docs
  instead of Firebase Auth custom claims (deliberately — see the file's header comment).
  The tournament creator is bootstrapped as `TOURNAMENT_ADMIN` automatically
  (`TournamentService.create()` writes their permission doc right after the tournament doc,
  and the rules have a matching one-time bootstrap exception keyed on `createdBy`).
  **Not deployed.** Platform-wide `SUPER_ADMIN` is an explicit TODO —
  `isSuperAdmin()` always returns `false`.

### What's NOT implemented

- Editing a tournament's config after creation (wizard steps 4-10, branding, visibility)
  — currently Firestore-console-only.
- Score entry (captains recording match results) — matches/standings assume data exists,
  nothing writes a `Match` doc yet.
- Manual/drag-drop team assignment, group generation as its own separate step (currently
  folded into team generation — see `teamGenerator.ts`'s `groupLabelFor`), knockout/playoff
  bracket generation, notifications, branding customization UI, CSV export, analytics.
- Any manual/browser testing whatsoever.

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
