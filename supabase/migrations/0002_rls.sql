-- ============================================================================
-- KOC3 — Auth claims hook + Row Level Security (RLS)
-- ----------------------------------------------------------------------------
-- Mirrors the old Firebase `database.rules.json`:
--   * Firebase `auth.token.superAdmin === true`  -> role SUPER_ADMIN
--   * Firebase `auth.token.teamId === $teamId`    -> profile.team_id
--   * "auth != null"                              -> any logged-in user
--
-- Roles live in public.profiles and are copied into the JWT by the access
-- token hook below, so RLS policies can read them via auth.jwt().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Access token hook: inject role / team_id / is_super_admin into the JWT
--    Enable it afterwards in Dashboard -> Authentication -> Hooks
--    (Customize Access Token), pointing at public.custom_access_token_hook.
-- ---------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  prof   public.profiles%rowtype;
begin
  select * into prof from public.profiles where id = (event->>'user_id')::uuid;
  claims := coalesce(event->'claims', '{}'::jsonb);

  if prof.id is not null then
    claims := jsonb_set(claims, '{user_role}',      to_jsonb(coalesce(prof.role, 'CAPTAIN')));
    claims := jsonb_set(claims, '{team_id}',        to_jsonb(coalesce(prof.team_id, '')));
    claims := jsonb_set(claims, '{is_super_admin}', to_jsonb(prof.role = 'SUPER_ADMIN'));
  else
    -- No profile (e.g. a brand-new sign-up): treat as a read-only guest.
    claims := jsonb_set(claims, '{user_role}', to_jsonb('GUEST'::text));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Only the auth server may run the hook + read profiles for it.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on table public.profiles to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- 2) Claim helper functions (read the current request's JWT)
-- ---------------------------------------------------------------------------
create or replace function public.jwt_role() returns text
language sql stable as $$ select coalesce(auth.jwt() ->> 'user_role', ''); $$;

create or replace function public.jwt_team_id() returns text
language sql stable as $$ select coalesce(auth.jwt() ->> 'team_id', ''); $$;

create or replace function public.is_super_admin() returns boolean
language sql stable as $$ select public.jwt_role() = 'SUPER_ADMIN'; $$;

-- SUPER_ADMIN or ADMIN — the two roles that reach the admin dashboard.
create or replace function public.can_admin() returns boolean
language sql stable as $$ select public.jwt_role() in ('SUPER_ADMIN', 'ADMIN'); $$;

-- Any real signed-in user (captain or admin). Excludes logged-out / guest.
create or replace function public.can_write() returns boolean
language sql stable as $$ select public.jwt_role() in ('SUPER_ADMIN', 'ADMIN', 'CAPTAIN'); $$;

-- ---------------------------------------------------------------------------
-- 3) Helper that enables RLS and (re)creates a read + a write policy
-- ---------------------------------------------------------------------------
create or replace function public._apply_policies(tbl text, read_cond text, write_cond text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format('drop policy if exists %I on public.%I', tbl || '_read',  tbl);
  execute format('drop policy if exists %I on public.%I', tbl || '_write', tbl);
  -- Reads are allowed for logged-out visitors (anon) too, so the public
  -- pages (Teams / Standings / Schedule) work without logging in.
  execute format('create policy %I on public.%I for select to anon, authenticated using (%s)',
                 tbl || '_read', tbl, read_cond);
  execute format('create policy %I on public.%I for all to authenticated using (%s) with check (%s)',
                 tbl || '_write', tbl, write_cond, write_cond);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Apply policies per table
-- ---------------------------------------------------------------------------
select public._apply_policies('teams',              'true',                    'public.can_admin()');
select public._apply_policies('schedule',           'true',                    'public.can_admin()');
select public._apply_policies('player_ratings',     'true',                    'public.can_admin()');
select public._apply_policies('settings',           'true',                    'public.can_admin()');
select public._apply_policies('legacy_koc2db',      'true',                    'public.can_admin()');
select public._apply_policies('legacy_season1',     'true',                    'public.can_admin()');
select public._apply_policies('revealed_lineups',   'true',                    'public.can_admin()');

-- Any signed-in user (captain/admin) may write: matches + the derived tables
-- that get recomputed every time a score is entered.
select public._apply_policies('matches',            'true', 'public.can_write()');
select public._apply_policies('cached_summaries',   'true', 'public.can_write()');
select public._apply_policies('standings',          'true', 'public.can_write()');
select public._apply_policies('pprc_ratings',       'true', 'public.can_write()');
select public._apply_policies('player_history',     'true', 'public.can_write()');
select public._apply_policies('team_history',       'true', 'public.can_write()');
select public._apply_policies('player_matchups',    'true', 'public.can_write()');
select public._apply_policies('team_matchups',      'true', 'public.can_write()');
select public._apply_policies('player_eligibility', 'true', 'public.can_write()');

-- Admin-only tables
select public._apply_policies('admin_config',  'public.can_admin()', 'public.can_admin()');
select public._apply_policies('admin_users',   'public.can_admin()', 'public.can_admin()');
select public._apply_policies('lineup_unlocks','public.can_admin()', 'public.can_admin()');
select public._apply_policies('lineup_deletes','public.can_admin()', 'public.can_admin()');

-- Audit logs: any signed-in user can append; only admins can read.
select public._apply_policies('audit_logs',    'public.can_admin()', 'public.can_write()');

-- Lineups: a captain may read/write only their own team; admins all;
-- everyone may read a lineup once it has been revealed.
select public._apply_policies(
  'lineup_submissions',
  'public.can_admin() or team_id = public.jwt_team_id() or (data->>''revealedAt'') is not null',
  'public.can_admin() or team_id = public.jwt_team_id()'
);
select public._apply_policies(
  'lineup_submission_meta',
  'true',
  'public.can_admin() or team_id = public.jwt_team_id()'
);

-- Profiles: you can read your own row; admins manage all.
select public._apply_policies('profiles', 'id = auth.uid() or public.can_admin()', 'public.can_admin()');

-- Let the auth server read profiles for the access-token hook (bypasses the
-- authenticated-only policies above).
drop policy if exists profiles_auth_admin_read on public.profiles;
create policy profiles_auth_admin_read on public.profiles
  for select to supabase_auth_admin using (true);

-- ---------------------------------------------------------------------------
-- 5) Table privileges (RLS still gates every row; these just let the API roles
--    attempt the operations). Supabase usually grants these automatically, but
--    we set them explicitly so a fresh project never hits "permission denied".
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
