# Tournament Platform v2

A ground-up rewrite (React + TypeScript + Material UI + Firebase **Firestore**) implementing
the "unlimited clubs and tournaments on one codebase" platform vision. This is intentionally
**not** an extension of `../frontend` (the live KOC app, which stays on plain JS + Firebase
**Realtime Database** and is not touched by anything in this directory) — see
`memory/MULTI_CLUB_SAAS_PLAN.md` for why those two goals conflict and were split into
separate efforts.

## Status: full create → configure → play → publish flow implemented, actively being tested

Typechecks and builds clean (`npm run build`). Currently being tested against a real
Firestore project for the first time — see the Setup section for what needs to be true in
that project (Firestore + Auth enabled, a user created, rules deployed) before it works
end-to-end. Treat this as "should work, being verified," not "verified."

### What's implemented

- **Data model** (`src/types/`): full `TournamentConfig` covering wizard steps 1, 3, 5-10
  from the spec (info, structure, match types, scoring, standings, playoffs, registration,
  per-page visibility, branding).
- **Tournament-scoped data access**: `TournamentScopedRepository` roots every read/write at
  `tournaments/{tournamentId}/{collection}` — no hand-written Firestore path
  anywhere. `TournamentService` handles tournament-level CRUD (create/list/publish/
  archive/duplicate/delete).
- **Admin flow**: sign in → Tournament Manager → Create Tournament wizard (Steps 1-3: info,
  type, structure — steps 4-10 get defaults, editable afterward in **Settings**) →
  tournament detail page → **Import Players** (CSV or JSON upload, column mapping,
  duplicate detection) → **Generate Teams** (random or UTR-balanced snake draft, split
  across the configured group count) → **Generate Schedule** (round-robin per group,
  configurable start date/time) → **Publish**.
- **Tournament Settings** (`/admin/tournaments/{id}/edit`): revisit every wizard step after
  creation — info/rules text, type, structure, player config, match types + lineup,
  scoring, standings tiebreak order (reorderable), playoffs, registration, per-page
  visibility, branding. Saves the whole config back via `TournamentService.updateConfig`.
- **Score Entry** (`/t/{slug}/score`, captain-gated): pick one of your team's scheduled
  matches, select players per line (derived from `config.lineup` + `config.matchTypes` via
  `src/services/matchLines.ts`), enter set scores validated against `config.scoring`
  (`src/services/scoringEngine.ts` — same config-driven design as the koc3-app PR's
  `tennisScoreRules.js`), save → writes a `Match` doc and marks the schedule entry `PLAYED`.
  **No admin-approval step yet** — a captain's submitted score is immediately `APPROVED`.
- **Public site** (`/t/{slug}`): Home, Schedule, Standings (computed client-side from
  matches via `src/services/standingsEngine.ts`, driven by `config.standings.tiebreakOrder`
  — same design as the koc3-app PR's `standingsRanking.js`), Teams, Rules.
- **Per-page visibility**: `VisibilityGate` reads `tournament.config.visibility[pageId]` and
  the signed-in user's resolved per-tournament role (`useTournamentRole`, backed by a
  `permissions/{uid}` doc) to decide render vs. a locked message. **This is a UI convenience
  only** — `firestore.rules` is the actual security boundary.
- **`firestore.rules`**: tournament isolation via same-subtree `permissions/{uid}` docs
  instead of Firebase Auth custom claims (deliberately — see the file's header comment).
  The tournament creator is bootstrapped as `TOURNAMENT_ADMIN` automatically. Captains can
  update their own team's scheduled matches (score entry) and create/update matches their
  team is part of, but can't touch an already-`APPROVED` match. Platform-wide `SUPER_ADMIN`
  is an explicit TODO — `isSuperAdmin()` always returns `false`.
- **Signup + role invites** — this is what actually connects "a captain" to "a screen they
  can see": `/admin/signup` lets anyone self-register a Firebase Auth account (no admin
  console needed anymore). Admins use **Team Roles** (`/admin/tournaments/{id}/roles`) to
  invite an email address as `CAPTAIN`/`VICE_CAPTAIN`/`PLAYER` (per team) or `ORGANIZER`,
  which writes `tournaments/{id}/invites/{normalizedEmail}`. The moment that person signs
  in (new or existing account) and visits the tournament's public site,
  `useClaimPendingInvite` finds the matching invite and self-creates their
  `permissions/{uid}` doc — no Cloud Function needed. The public site header shows a Sign
  In link (signed out) or the resolved role + Sign Out (signed in). **Not yet verified
  against a real deploy** — see the case-sensitivity caveat in
  `hooks/useClaimPendingInvite.ts` and `firestore.rules`' `permissions`/`invites` blocks
  (email matching relies on `request.auth.token.email` casing, which isn't guaranteed to
  match the lowercased invite doc id in every case).

### What's NOT implemented

- Admin approval workflow for submitted scores (see Score Entry note above).
- Un-inviting / changing someone's role once claimed (Team Roles only creates invites, no
  edit/revoke UI yet — do it directly in Firestore for now).
- Manual/drag-drop team assignment, group generation as its own separate step (currently
  folded into team generation — see `teamGenerator.ts`'s `groupLabelFor`), knockout/playoff
  bracket generation, notifications, CSV export, analytics.
- Full manual/browser testing — this is in progress now; expect rough edges.

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
- Authentication → Email/Password provider enabled. First account: use `/admin/signup` in
  the app itself (or create one directly in the Firebase console, same effect) — whoever
  creates a tournament automatically becomes its admin, no manual role assignment needed
  for that first account.
- `firestore.rules` deployed (`firebase deploy --only firestore:rules` from a machine with
  the Firebase CLI and credentials for that project — not available in the session that
  wrote this) — redeploy any time this file changes, including this update.

## Commands

```bash
npm run dev         # dev server
npm run typecheck   # tsc --noEmit
npm run build        # typecheck + production build
npm run preview      # serve the production build locally
```
