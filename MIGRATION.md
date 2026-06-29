# KOC3 → Supabase migration guide (for beginners)

This app used to run on **Firebase** (Realtime Database + a Cloud Function).
It now runs on **Supabase** (PostgreSQL + Auth + Row Level Security + Realtime).

You don't need to understand all of it. Just follow the steps **in order**.
Each step says exactly what to click or type. Total time: ~30–45 minutes.

> Tip: keep a notepad open. You'll collect 3 secret values along the way:
> **Project URL**, **anon key**, and **service role key**.

---

## What changed (the 30-second version)

| Before (Firebase) | After (Supabase) |
|---|---|
| Realtime Database (one big JSON tree) | Postgres tables you can see & query (`teams`, `matches`, …) |
| `database.rules.json` security | Row Level Security (RLS) policies in SQL |
| Cloud Function `revealLineupsOnLock` | A Postgres trigger (`0003_reveal_trigger.sql`) |
| Login: password checked in the browser | Real **Supabase Auth** accounts (same passwords) |

The old Firebase files (`firebase.json`, `database.rules.json`, `functions/`,
`frontend/src/firebaseConfig.js`) are **left in place but unused**, so you can
roll back with `git revert` if needed.

---

## Step 1 — Create a Supabase project

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. Click **New project**.
   - Name: `koc3` (anything).
   - **Database Password**: pick a strong one and **save it**.
   - Region: pick the one closest to your players.
3. Wait ~2 minutes for it to finish setting up.

### Grab your keys
Open **Project Settings** (gear icon) → **API**. Copy these:
- **Project URL** — looks like `https://abcdxyz.supabase.co`
- **anon public** key — a long string (safe to put in the browser)
- **service_role** key — a long string (⚠️ **SECRET** — never commit/share it)

---

## Step 2 — Create the database tables

1. In Supabase, open **SQL Editor** (left sidebar) → **New query**.
2. Open the file `supabase/migrations/0001_schema.sql` from this repo, copy ALL
   of it, paste into the editor, and click **Run**.
3. Repeat for `supabase/migrations/0002_rls.sql`.
4. Repeat for `supabase/migrations/0003_reveal_trigger.sql`.

Run them **in that order**. Each should say "Success. No rows returned."

You can now see your (empty) tables under **Table Editor**.

---

## Step 3 — Turn on the login-roles hook

This makes Supabase put each user's role (admin / captain) into their login
token, which the security rules rely on.

1. Go to **Authentication** → **Hooks** (sometimes under "Auth Hooks").
2. Find **Customize Access Token (JWT) Claims** → **Add hook** / **Enable**.
3. Choose **Postgres function**, then select schema `public` and function
   **`custom_access_token_hook`**.
4. Save / enable it.

Also check **Authentication → Providers → Email** is **enabled** (it is by
default). You do **not** need email confirmation — the migration creates the
accounts already confirmed.

---

## Step 4 — Export your data from Firebase

1. Open the [Firebase console](https://console.firebase.google.com) → your
   project (`koc2-20fb8`).
2. Go to **Realtime Database**.
3. Click the **⋮ (three dots)** menu at the top-right of the data view →
   **Export JSON**.
4. Save the file somewhere easy, e.g. `koc-export.json`.

That file contains everything (`koc_s3`, plus the legacy archives).

---

## Step 5 — Copy your data into Supabase

This runs a one-time script that fills the tables **and** creates a login
account for every team and admin (using their existing passwords).

In a terminal:

```bash
cd scripts
npm install

# paste YOUR values (URL from Step 1, service_role key from Step 1):
export SUPABASE_URL="https://YOUR-PROJECT-REF.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="YOUR-SERVICE-ROLE-KEY"

node migrate-rtdb-to-supabase.mjs /full/path/to/koc-export.json
```

You'll see lines like `✓ teams: 16 rows` and `✓ account team1@team.koc3.local`.
If something fails, fix the cause and just run it again — it's safe to re-run.

> The `service_role` key bypasses all security, so only use it here, on your own
> machine. Never put it in the website or commit it to git.

---

## Step 6 — Point the website at Supabase

1. In the `frontend/` folder, copy `.env.example` to `.env`:
   ```bash
   cd frontend
   cp .env.example .env
   ```
2. Edit `frontend/.env` and fill in your **Project URL** and **anon** key:
   ```
   REACT_APP_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```
3. Run it locally to test:
   ```bash
   npm install
   npm start
   ```
4. Open <http://localhost:3000>. Public pages (Teams, Standings, Schedule)
   should show your data. Then test logging in (see "Logins" below).

---

## Step 7 — Deploy (Netlify)

The site is built by Netlify (see `netlify.toml`). Add the same two values as
environment variables so the live site can reach Supabase:

1. Netlify → your site → **Site configuration → Environment variables**.
2. Add:
   - `REACT_APP_SUPABASE_URL` = your Project URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your anon key
3. Trigger a new deploy (**Deploys → Trigger deploy → Deploy site**).

> ⚠️ You can now safely turn off / delete the old Firebase project once you've
> confirmed the Supabase site works. (Keep the Firebase export file as a backup.)

---

## Logins (what to tell your captains/admins)

Passwords are **unchanged**. Only where you type the username differs:

- **Team captains**: pick the team from the dropdown, enter the team password
  (same as before, e.g. `KOC<ABBR>#3`).
- **Admins**: type the admin **username** (e.g. `damuredii`) + the admin
  password (e.g. `KOCPO#ADMIN`).

Behind the scenes each maps to a hidden email like `team1@team.koc3.local` or
`damuredii@admin.koc3.local` — you never type those.

---

## How the security works now (FYI)

- Logged-out visitors can **read** public tables (Teams/Standings/Schedule),
  exactly like before.
- Only signed-in **captains** can submit their own team's lineup / scores;
  only **admins** can edit teams, schedule, ratings, and settings.
- These rules live in `0002_rls.sql` and are enforced by the database itself,
  so they can't be bypassed from the browser. They mirror the old
  `database.rules.json`.

## Troubleshooting

- **"Supabase configuration is missing"** → `frontend/.env` isn't filled in (or
  you didn't restart `npm start` after editing it).
- **Public pages are empty** → re-run Step 5; check the tables have rows in the
  Table Editor.
- **Can't log in** → make sure Step 3 (the hook) is enabled and Step 5 created
  accounts (look for the `✓ account ...` lines). Re-running Step 5 resets
  passwords to match the export.
- **Lineups don't auto-reveal** → confirm `0003_reveal_trigger.sql` ran without
  errors.

---

## File map (where things live now)

```
supabase/migrations/0001_schema.sql        Tables + realtime
supabase/migrations/0002_rls.sql           Auth claims hook + security policies
supabase/migrations/0003_reveal_trigger.sql  Lineup auto-reveal (was a Cloud Function)
scripts/migrate-rtdb-to-supabase.mjs       One-time data + accounts migration
frontend/src/supabaseClient.js             Supabase connection + login email helpers
frontend/src/firebase.js                   Data layer (same API as before, now on Supabase)
frontend/.env.example                      Template for your keys
```
