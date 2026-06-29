# KOC3 — Tennis Tournament PWA

A mobile-first React PWA for running the KOC tennis tournament (teams,
schedule, score entry, standings, lineups).

## Backend: Supabase

This app runs on **Supabase** (PostgreSQL + Auth + Realtime). It was migrated
from Firebase Realtime Database.

- **New here / setting it up?** Follow **[MIGRATION.md](./MIGRATION.md)** — a
  step-by-step, beginner-friendly guide (create the project, load your data,
  configure logins, deploy).
- Database definition lives in `supabase/migrations/*.sql`.
- Frontend lives in `frontend/` (Create React App).
- Running separate **dev / test / prod**? See **[ENVIRONMENTS.md](./ENVIRONMENTS.md)**.

## Quick start (after Supabase is set up)

```bash
cd frontend
cp .env.example .env      # fill in your Supabase URL + anon key
npm install
npm start                 # http://localhost:3000
```

## Layout

| Path | What it is |
|---|---|
| `frontend/` | React PWA |
| `supabase/migrations/` | Postgres schema, RLS policies, triggers |
| `scripts/` | One-time Firebase → Supabase data migration |
| `legacy/`, `functions/`, `firebase.json` | Old Firebase files, kept for reference |
