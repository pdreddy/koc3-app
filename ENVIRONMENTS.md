# Dev / Test / Prod environments

Each environment is its **own Supabase project** — fully isolated data, logins,
and keys. Nothing you do in dev can touch prod.

| Env | Where it runs | Supabase project | Frontend config source |
|---|---|---|---|
| **dev**  | your laptop (`npm start`) | `koc3-dev`  | `frontend/.env.development` (local file) |
| **test** | Netlify branch/preview deploys | `koc3-test` | Netlify env vars (Branch deploys scope) |
| **prod** | Netlify production (main branch) | `koc3-prod` | Netlify env vars (Production scope) |

> **Important:** the local `frontend/.env*` files are git-ignored and only affect
> commands you run on your machine. **Deploys on Netlify use the environment
> variables you set in the Netlify dashboard**, scoped per context — that's how
> test vs prod get different Supabase projects.

---

## Step 1 — Create the projects
In Supabase, create up to three projects: `koc3-dev`, `koc3-test`, `koc3-prod`.
For each, note its **Reference ID** (Project Settings → General), e.g. `abcd1234`.

> Free tier allows **2 active projects** at a time. Options: start with `dev` +
> `prod`, add `test` later, or pause an unused project, or upgrade to a paid org.

## Step 2 — Map envs to projects
```bash
cd scripts
cp environments.example.json environments.json
```
Edit `scripts/environments.json` and paste each project's Reference ID:
```json
{
  "dev":  { "projectRef": "your-dev-ref" },
  "test": { "projectRef": "your-test-ref" },
  "prod": { "projectRef": "your-prod-ref" }
}
```
(This file is git-ignored.)

## Step 3 — Provision each environment
One access token manages all your projects. Run setup per env (same Firebase
export is fine to load into each at first):
```bash
export SUPABASE_ACCESS_TOKEN="sbp_...your token..."

node setup-supabase.mjs --env dev  ~/Downloads/koc-export.json
node setup-supabase.mjs --env test ~/Downloads/koc-export.json
node setup-supabase.mjs --env prod ~/Downloads/koc-export.json
```
Each run resets + builds that project's schema, enables the hook, imports the
data + accounts, and then:
- **dev** → writes `frontend/.env.development` (used by `npm start`).
- **test / prod** → prints the `REACT_APP_SUPABASE_URL` + `..._ANON_KEY` to paste
  into Netlify.

## Step 4 — Run dev locally
```bash
cd frontend && npm install && npm start
```
This uses `.env.development` → your `koc3-dev` project.

## Step 5 — Wire up Netlify (test + prod)
In Netlify → **Site configuration → Environment variables**, add
`REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`, and use
**"Different value for each deploy context"**:
- **Production** scope → the `prod` values (printed by `--env prod`).
- **Branch deploys / Deploy Previews** scope → the `test` values (`--env test`).

Then map a branch to "test": Netlify → **Build & deploy → Branches** → add e.g.
`staging` as a branch deploy. Pushing to `staging` deploys against `koc3-test`;
merging to your production branch deploys against `koc3-prod`.

---

## Day-to-day
- Build/try features against **dev** locally.
- Push to `staging` → auto-deploys to **test** (real URL, isolated data) for QA.
- Merge to production branch → deploys to **prod**.
- Schema changes: edit `supabase/migrations/*.sql`, then re-run
  `setup-supabase.mjs --env <env>` for each environment (remember: it **resets**
  that project and re-imports from the export — see the reset note in MIGRATION.md).
