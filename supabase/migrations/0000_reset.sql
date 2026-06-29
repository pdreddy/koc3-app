-- ============================================================================
-- KOC3 — Reset (DESTRUCTIVE)
-- ----------------------------------------------------------------------------
-- Drops every KOC3 table so the schema can be rebuilt from a clean slate.
-- Safe to run before the first real data import. Do NOT run on a database that
-- already holds live data you haven't exported — it deletes all rows.
--
-- (Auth users in auth.users are NOT touched; only public.profiles is dropped
-- and rebuilt. The data-migration step re-links profiles afterwards.)
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'teams','matches','schedule','player_ratings','admin_config','admin_users',
    'settings','cached_summaries','standings','pprc_ratings','player_history',
    'team_history','player_matchups','team_matchups','player_eligibility',
    'audit_logs','lineup_submissions','lineup_submission_meta','revealed_lineups',
    'lineup_unlocks','lineup_deletes','legacy_koc2db','legacy_season1','profiles'
  ]
  loop
    execute format('drop table if exists public.%I cascade', t);
  end loop;
end $$;
