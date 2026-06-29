#!/usr/bin/env node
// ============================================================================
// KOC3 — One-command Supabase setup (run this on YOUR machine, not in CI).
// ----------------------------------------------------------------------------
// Does the whole backend setup for you, using the Supabase Management API:
//   1) Runs the 3 SQL migrations (schema, RLS, reveal trigger).
//   2) Enables the "Customize Access Token" auth hook.
//   3) Fetches your anon + service_role keys and writes frontend/.env.
//   4) Imports your Firebase export (data + login accounts).
//
// Usage (per environment — see ENVIRONMENTS.md):
//   SUPABASE_ACCESS_TOKEN=sbp_xxx \
//   node scripts/setup-supabase.mjs --env dev  /full/path/to/koc-export.json
//   node scripts/setup-supabase.mjs --env test /full/path/to/koc-export.json
//   node scripts/setup-supabase.mjs --env prod /full/path/to/koc-export.json
//
// Which Supabase project each env maps to comes from scripts/environments.json
// (copy environments.example.json). One project per environment = full
// isolation (separate data, logins, keys). Override the project once with
// SUPABASE_PROJECT_REF. If you have a single project and no config, it's
// auto-detected.
//
// Get a personal access token: Supabase -> account avatar -> Access Tokens.
// Requires Node 18+ (uses built-in fetch). Revoke the token when you're done.
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

// --- parse args: [--env dev|test|prod] [--schema-only] [--no-reset] [export.json] ---
const argv = process.argv.slice(2);
let ENV = process.env.ENV || '';
let schemaOnly = false;   // promote structure only, skip data + accounts import
let noReset = false;      // don't wipe the project first (idempotent schema apply)
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--env') ENV = argv[++i] || '';
  else if (argv[i].startsWith('--env=')) ENV = argv[i].slice(6);
  else if (argv[i] === '--schema-only') schemaOnly = true;
  else if (argv[i] === '--no-reset') noReset = true;
  else positional.push(argv[i]);
}
ENV = (ENV || 'prod').toLowerCase();
const exportPath = positional[0];

// dev runs locally (npm start); test/prod are Netlify deploy contexts.
const ENV_FILE = { dev: '.env.development', test: '.env.test', prod: '.env.production' };
const NETLIFY_SCOPE = { dev: 'local only (npm start)', test: 'Branch deploys & Deploy Previews', prod: 'Production' };

function projectRefForEnv(env) {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const p = join(__dirname, 'environments.json');
  if (!existsSync(p)) return undefined;
  try { return JSON.parse(readFileSync(p, 'utf8'))?.[env]?.projectRef || undefined; }
  catch { return undefined; }
}

let REF = projectRefForEnv(ENV);

if (!ACCESS_TOKEN) { console.error('Set SUPABASE_ACCESS_TOKEN (Supabase -> Account -> Access Tokens).'); process.exit(1); }
if (!ENV_FILE[ENV]) { console.error(`--env must be one of: dev, test, prod (got "${ENV}")`); process.exit(1); }
if (!schemaOnly) {
  if (!exportPath) { console.error('Usage: node scripts/setup-supabase.mjs --env <dev|test|prod> <firebase-export.json>\n   (or add --schema-only to promote just the structure, no data)'); process.exit(1); }
  if (!existsSync(resolve(exportPath))) {
    console.error(`\n❌ Export file not found: ${resolve(exportPath)}`);
    console.error('   Pass the real path to your Firebase JSON export, e.g.');
    console.error('   node setup-supabase.mjs --env dev ~/Downloads/koc2-20fb8-export.json');
    console.error('   (Tip: drag the file into the terminal to paste its path.)\n');
    process.exit(1);
  }
}

const API = 'https://api.supabase.com';
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function pickProject() {
  if (REF) return REF;
  const projects = await api('/v1/projects');
  if (!projects.length) throw new Error('No Supabase projects found for this token.');
  if (projects.length === 1) { console.log(`Using project: ${projects[0].name} (${projects[0].id})`); return projects[0].id; }
  console.error('Multiple projects found — set SUPABASE_PROJECT_REF to one of:');
  projects.forEach((p) => console.error(`  ${p.id}  ${p.name}`));
  process.exit(1);
}

async function runSql(label, sql) {
  await api(`/v1/projects/${REF}/database/query`, { method: 'POST', body: { query: sql } });
  console.log(`✓ ran ${label}`);
}

async function enableHook() {
  await api(`/v1/projects/${REF}/config/auth`, {
    method: 'PATCH',
    body: {
      hook_custom_access_token_enabled: true,
      hook_custom_access_token_uri: 'pg-functions://postgres/public/custom_access_token_hook',
    },
  });
  console.log('✓ enabled access-token hook');
}

async function fetchKeys() {
  const keys = await api(`/v1/projects/${REF}/api-keys?reveal=true`);
  const byName = (n) => keys.find((k) => k.name === n || k.type === n);
  const anon = byName('anon') || byName('publishable');
  const service = byName('service_role') || byName('secret');
  if (!anon?.api_key || !service?.api_key) {
    throw new Error('Could not read anon/service_role keys — grab them from Dashboard -> Settings -> API.');
  }
  return { anonKey: anon.api_key, serviceKey: service.api_key };
}

function writeEnv(url, anonKey) {
  const envPath = join(REPO, 'frontend', ENV_FILE[ENV]);
  writeFileSync(envPath, `REACT_APP_SUPABASE_URL=${url}\nREACT_APP_SUPABASE_ANON_KEY=${anonKey}\n`);
  console.log(`✓ wrote ${envPath}`);
}

function runDataMigration(url, serviceKey) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn('node', [join(__dirname, 'migrate-rtdb-to-supabase.mjs'), resolve(exportPath)], {
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey },
    });
    child.on('exit', (code) => (code === 0 ? resolveP() : rejectP(new Error(`data migration exited with code ${code}`))));
  });
}

async function main() {
  REF = await pickProject();
  const url = `https://${REF}.supabase.co`;
  console.log(`\nSetting up [${ENV}] -> ${url}\n`);

  const dir = join(REPO, 'supabase', 'migrations');
  if (noReset) {
    console.log('Applying schema idempotently (no reset; existing data preserved)...');
  } else {
    console.log('Resetting schema to a clean slate' + (schemaOnly ? '' : ' (data is re-imported below)') + '...');
    await runSql('0000_reset.sql', readFileSync(join(dir, '0000_reset.sql'), 'utf8'));
  }
  await runSql('0001_schema.sql', readFileSync(join(dir, '0001_schema.sql'), 'utf8'));
  await runSql('0002_rls.sql', readFileSync(join(dir, '0002_rls.sql'), 'utf8'));
  await runSql('0003_reveal_trigger.sql', readFileSync(join(dir, '0003_reveal_trigger.sql'), 'utf8'));

  await enableHook();

  const { anonKey, serviceKey } = await fetchKeys();
  writeEnv(url, anonKey);

  if (schemaOnly) {
    console.log('\nSchema-only: skipped data + accounts import.');
  } else {
    console.log('\nImporting your data + accounts...\n');
    await runDataMigration(url, serviceKey);
  }

  console.log(`\n✅ [${ENV}] done. Project: ${url}`);
  if (ENV === 'dev') {
    console.log('\nNext (local):');
    console.log('   cd frontend && npm install && npm start   # uses .env.development -> dev project');
  } else {
    console.log(`\nNext: in Netlify, set these for the "${NETLIFY_SCOPE[ENV]}" scope (Site config -> Environment variables):`);
    console.log(`   REACT_APP_SUPABASE_URL=${url}`);
    console.log(`   REACT_APP_SUPABASE_ANON_KEY=${anonKey}`);
    console.log('   then trigger a deploy for that context.');
  }
  console.log('\nWhen all environments are set up, revoke your Supabase access token.\n');
}

main().catch((err) => { console.error('\n❌ Setup failed:', err.message, '\n'); process.exit(1); });
