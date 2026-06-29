#!/usr/bin/env node
// ============================================================================
// KOC3 — Set / reset a login password (Supabase Auth)
// ----------------------------------------------------------------------------
// Login now uses Supabase Auth accounts (not the old password fields in the
// tables). Use this to create or reset a team or admin password.
//
// Usage:
//   SUPABASE_URL=https://YOUR.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=...secret/service_role key... \
//   node scripts/set-password.mjs admin <username> <password> [SUPER_ADMIN|ADMIN]
//   node scripts/set-password.mjs team  <teamId>   <password>
//
// Get the key: Dashboard -> Project Settings -> API -> "service_role" (legacy)
// or "secret" (new sb_secret_...) -> Reveal.  Keep it secret.
// ============================================================================
import { createClient } from '@supabase/supabase-js';

const [, , kind, idArg, password, roleArg] = process.argv;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AUTH_EMAIL_DOMAIN = 'koc3.local';
const teamAuthEmail = (teamId) => `${String(teamId).toLowerCase()}@team.${AUTH_EMAIL_DOMAIN}`;
const adminAuthEmail = (username) => `${String(username).toLowerCase()}@admin.${AUTH_EMAIL_DOMAIN}`;

function usage() {
  console.error('Usage:');
  console.error('  node scripts/set-password.mjs admin <username> <password> [SUPER_ADMIN|ADMIN]');
  console.error('  node scripts/set-password.mjs team  <teamId>   <password>');
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Dashboard -> Project Settings -> API; service_role / secret key).'); process.exit(1); }
if (!['admin', 'team'].includes(kind) || !idArg || !password) usage();
if (password.length < 6) { console.error('Password must be at least 6 characters.'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const email = kind === 'admin' ? adminAuthEmail(idArg) : teamAuthEmail(idArg);
const role = kind === 'admin' ? (roleArg || 'SUPER_ADMIN') : 'CAPTAIN';
const teamId = kind === 'team' ? idArg : null;

async function findUserByEmail(target) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = (data.users || []).find((u) => u.email === target.toLowerCase());
    if (found) return found;
    if (!data.users || data.users.length < 1000) return null;
  }
  return null;
}

async function main() {
  let user = await findUserByEmail(email);
  if (user) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    if (error) throw new Error(`updateUser: ${error.message}`);
    console.log(`✓ updated password for ${email}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`createUser: ${error.message}`);
    user = data.user;
    console.log(`✓ created ${email}`);
  }
  const { error } = await supabase.from('profiles').upsert(
    { id: user.id, role, team_id: teamId, username: kind === 'admin' ? idArg : null },
    { onConflict: 'id' }
  );
  if (error) throw new Error(`profile: ${error.message}`);
  console.log(`✓ profile set: role=${role}${teamId ? `, team=${teamId}` : ''}`);
  console.log(`\nLog in via the ${kind === 'admin' ? `Admin tab with username "${idArg}"` : 'Team tab (pick the team)'} and the password you just set.`);
}

main().catch((e) => { console.error('\n❌', e.message, '\n'); process.exit(1); });
