-- ============================================================================
-- KOC3 — Supabase schema (migrated from Firebase Realtime Database `koc_s3/*`)
-- ----------------------------------------------------------------------------
-- Each former RTDB "node" becomes a real Postgres table. The full record is
-- stored in a `data` jsonb column (so the existing app logic keeps working).
-- Frequently-sorted fields get an *expression index* on the json so queries
-- stay fast without depending on stored generated columns.
--
-- Run order: 0001_schema.sql -> 0002_rls.sql -> 0003_reveal_trigger.sql
-- (Paste each file into the Supabase SQL Editor, or use the Supabase CLI,
--  or run scripts/setup-supabase.mjs which does it for you.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Core entities
-- ---------------------------------------------------------------------------

create table if not exists public.teams (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.matches (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
create index if not exists matches_ts_idx
  on public.matches (((nullif(data->>'ts',''))::bigint) desc);

create table if not exists public.schedule (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.player_ratings (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Singletons / config (each is a single row)
-- ---------------------------------------------------------------------------

create table if not exists public.admin_config (
  id          text primary key,         -- always 'admin'
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.admin_users (
  username    text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.settings (
  id          text primary key,         -- always 'settings'
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.cached_summaries (
  id          text primary key,         -- always 'cachedSummaries'
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Legacy read-only archives (whole tree kept as a single jsonb blob)
create table if not exists public.legacy_koc2db (
  id          text primary key,         -- always 'root'
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.legacy_season1 (
  id          text primary key,         -- always 'root'
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Derived / computed collections (rebuilt whenever a score is processed)
-- ---------------------------------------------------------------------------

create table if not exists public.standings          ( id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now() );
create table if not exists public.pprc_ratings       ( id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now() );
create table if not exists public.player_history     ( id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now() );
create table if not exists public.team_history       ( id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now() );
create table if not exists public.player_matchups    ( id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now() );
create table if not exists public.team_matchups      ( id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now() );
create table if not exists public.player_eligibility ( id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now() );

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table if not exists public.audit_logs (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_ts_idx
  on public.audit_logs (((nullif(data->>'timestamp',''))::bigint) desc);

-- ---------------------------------------------------------------------------
-- Lineups (former 2-level RTDB nodes scheduleId -> teamId)
-- ---------------------------------------------------------------------------

create table if not exists public.lineup_submissions (
  schedule_id text not null,
  team_id     text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (schedule_id, team_id)
);

create table if not exists public.lineup_submission_meta (
  schedule_id text not null,
  team_id     text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (schedule_id, team_id)
);

create table if not exists public.revealed_lineups (
  id          text primary key,         -- revealId
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.lineup_unlocks ( id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now() );
create table if not exists public.lineup_deletes ( id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now() );

-- ---------------------------------------------------------------------------
-- Auth profile mapping (auth.users -> role / team).  Drives JWT claims + RLS.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         text not null default 'CAPTAIN',  -- SUPER_ADMIN | ADMIN | CAPTAIN
  team_id      text,                             -- e.g. 'team1' for captains
  username     text,
  name         text,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Realtime: publish every table the app subscribes to with onValue()
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'teams','matches','schedule','player_ratings','admin_config','admin_users',
    'settings','cached_summaries','standings','pprc_ratings','player_history',
    'team_history','player_matchups','team_matchups','player_eligibility',
    'audit_logs','lineup_submissions','lineup_submission_meta','revealed_lineups',
    'lineup_unlocks','lineup_deletes','legacy_koc2db','legacy_season1'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;  -- already in the publication
    end;
  end loop;
end $$;
