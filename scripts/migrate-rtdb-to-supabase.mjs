#!/usr/bin/env node
// ============================================================================
// KOC3 — One-time data migration: Firebase RTDB export  ->  Supabase
// ----------------------------------------------------------------------------
// What it does:
//   1) Reads a Firebase Realtime Database JSON export (exported from the
//      Firebase console: Realtime Database -> ⋮ -> Export JSON).
//   2) Inserts every node into the matching Supabase table.
//   3) Creates a Supabase Auth account for each team + each admin, using their
//      EXISTING password, and a matching row in public.profiles (role/team).
//
// Usage:
//   SUPABASE_URL=https://YOUR.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role-key... \
//   node scripts/migrate-rtdb-to-supabase.mjs ./koc-export.json
//
// The SERVICE ROLE key bypasses Row Level Security — keep it secret, never
// commit it, and only ever use it from your own machine / a server.
// ============================================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const [, , exportPath] = process.argv;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!exportPath) { console.error('Usage: node scripts/migrate-rtdb-to-supabase.mjs <firebase-export.json>'); process.exit(1); }
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.'); process.exit(1); }

const AUTH_EMAIL_DOMAIN = 'koc3.local';
const teamAuthEmail = (teamId) => `${String(teamId).toLowerCase()}@team.${AUTH_EMAIL_DOMAIN}`;
const adminAuthEmail = (username) => `${String(username).toLowerCase()}@admin.${AUTH_EMAIL_DOMAIN}`;

const DEFAULT_ADMIN_USERS = {
  damuredii: { username: 'damuredii', name: 'Damureddi', role: 'SUPER_ADMIN' },
  vionda:    { username: 'vionda',    name: 'Vionda',    role: 'ADMIN' },
  umav:      { username: 'umav',      name: 'Umav',      role: 'ADMIN' },
};

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const root = JSON.parse(readFileSync(exportPath, 'utf8'));
const s3 = root.koc_s3 || {};
const obj = (v) => (v && typeof v === 'object' ? v : {});

// Map collection node -> rows of { [keyCol]: id, data }
async function loadCollection(table, node, keyCol = 'id') {
  const entries = Object.entries(obj(node));
  if (!entries.length) { console.log(`· ${table}: (empty)`); return; }
  const rows = entries.map(([id, data]) => ({ [keyCol]: id, data: data ?? {} }));
  const { error } = await supabase.from(table).upsert(rows, { onConflict: keyCol });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`✓ ${table}: ${rows.length} rows`);
}

async function loadSingleton(table, value, id) {
  if (value == null) { console.log(`· ${table}: (empty)`); return; }
  const { error } = await supabase.from(table).upsert({ id, data: value }, { onConflict: 'id' });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`✓ ${table}: 1 row`);
}

async function loadNested2(table, node) {
  const rows = [];
  for (const [scheduleId, byTeam] of Object.entries(obj(node))) {
    for (const [teamId, data] of Object.entries(obj(byTeam))) {
      rows.push({ schedule_id: scheduleId, team_id: teamId, data: data ?? {} });
    }
  }
  if (!rows.length) { console.log(`· ${table}: (empty)`); return; }
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'schedule_id,team_id' });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`✓ ${table}: ${rows.length} rows`);
}

// Find an existing auth user by email (paginates through the user list).
async function findUserByEmail(email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = (data.users || []).find((u) => u.email === email.toLowerCase());
    if (found) return found;
    if (!data.users || data.users.length < 1000) return null;
  }
  return null;
}

// Create (or update password of) an auth user, then upsert its profile.
async function upsertAccount({ email, password, role, teamId = null, username = null, name = null }) {
  const pwd = String(password || '').trim();
  if (pwd.length < 6) { console.warn(`! skip ${email}: password missing or shorter than 6 chars`); return; }

  let user = null;
  const created = await supabase.auth.admin.createUser({
    email, password: pwd, email_confirm: true,
    user_metadata: { role, team_id: teamId, username, name },
  });
  if (created.error) {
    user = await findUserByEmail(email);
    if (!user) throw new Error(`createUser ${email}: ${created.error.message}`);
    await supabase.auth.admin.updateUserById(user.id, { password: pwd, email_confirm: true });
  } else {
    user = created.data.user;
  }

  const { error } = await supabase.from('profiles').upsert(
    { id: user.id, role, team_id: teamId, username, name }, { onConflict: 'id' }
  );
  if (error) throw new Error(`profile ${email}: ${error.message}`);
  console.log(`✓ account ${email} (${role}${teamId ? ', ' + teamId : ''})`);
}

async function main() {
  console.log(`\nMigrating ${exportPath} -> ${SUPABASE_URL}\n`);

  // --- 1) Data tables ---
  await loadCollection('teams', s3.teams);
  await loadCollection('matches', s3.matches);
  await loadCollection('schedule', s3.schedule);
  await loadCollection('player_ratings', s3.playerRatings);
  await loadCollection('admin_users', s3.adminUsers, 'username');
  await loadCollection('standings', s3.standings);
  await loadCollection('pprc_ratings', s3.pprcRatings);
  await loadCollection('player_history', s3.playerHistory);
  await loadCollection('team_history', s3.teamHistory);
  await loadCollection('player_matchups', s3.playerMatchups);
  await loadCollection('team_matchups', s3.teamMatchups);
  await loadCollection('player_eligibility', s3.playerEligibility);
  await loadCollection('audit_logs', s3.auditLogs);
  await loadCollection('revealed_lineups', s3.revealedLineups);
  await loadCollection('lineup_unlocks', s3.lineupUnlocks);
  await loadCollection('lineup_deletes', s3.lineupDeletes);

  await loadSingleton('admin_config', s3.admin ?? {}, 'admin');
  await loadSingleton('settings', s3.settings ?? {}, 'settings');
  await loadSingleton('cached_summaries', s3.cachedSummaries ?? {}, 'cachedSummaries');
  await loadSingleton('legacy_koc2db', root.KOC2DB ?? {}, 'root');
  await loadSingleton('legacy_season1', root.KOC2DBPONEW ?? {}, 'root');

  await loadNested2('lineup_submissions', s3.lineupSubmissions);
  await loadNested2('lineup_submission_meta', s3.lineupSubmissionMeta);

  // --- 2) Auth accounts + profiles ---
  console.log('\nCreating login accounts...\n');
  const centralAdminPassword = String(obj(s3.admin).password || '').trim();

  // Teams -> captain accounts
  for (const [teamId, team] of Object.entries(obj(s3.teams))) {
    const abbr = team?.abbreviation || '';
    const password = String(team?.password || (abbr ? `KOC${abbr}#3` : '')).trim();
    await upsertAccount({ email: teamAuthEmail(teamId), password, role: 'CAPTAIN', teamId, name: team?.name || teamId });
  }

  // Admins -> admin accounts (from export, falling back to known defaults)
  const adminUsers = { ...DEFAULT_ADMIN_USERS, ...obj(s3.adminUsers) };
  for (const [username, info] of Object.entries(adminUsers)) {
    const password = String(info?.password || centralAdminPassword || '').trim();
    await upsertAccount({
      email: adminAuthEmail(username),
      password,
      role: info?.role || 'SUPER_ADMIN',
      username,
      name: info?.name || username,
    });
  }

  console.log('\n✅ Migration complete.\n');
}

main().catch((err) => { console.error('\n❌ Migration failed:', err.message, '\n'); process.exit(1); });
