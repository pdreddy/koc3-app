import { createClient } from '@supabase/supabase-js';

// Supabase project URL + anon (public) key. Set these in frontend/.env:
//   REACT_APP_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
//   REACT_APP_SUPABASE_ANON_KEY=YOUR-ANON-KEY
// The anon key is safe to expose in the browser — Row Level Security (RLS)
// in Postgres is what actually protects the data.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase configuration is missing. Set REACT_APP_SUPABASE_URL and ' +
    'REACT_APP_SUPABASE_ANON_KEY in frontend/.env (see MIGRATION.md).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Supabase Auth needs an email per account. Teams/admins don't have real
// emails, so we derive a stable synthetic one. The migration script creates
// the matching auth users with the SAME rule + each account's existing
// password, so nobody's password changes.
export const AUTH_EMAIL_DOMAIN = 'koc3.local';
export const teamAuthEmail = (teamId) => `${String(teamId).toLowerCase()}@team.${AUTH_EMAIL_DOMAIN}`;
export const adminAuthEmail = (username) => `${String(username).toLowerCase()}@admin.${AUTH_EMAIL_DOMAIN}`;
