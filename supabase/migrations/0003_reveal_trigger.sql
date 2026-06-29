-- ============================================================================
-- KOC3 — Lineup reveal trigger
-- ----------------------------------------------------------------------------
-- Port of functions/index.js (Firebase Cloud Function `revealLineupsOnLock`).
-- When BOTH teams in a fixture have locked a valid lineup, the lineups are
-- "revealed" (copied into revealed_lineups) and both submissions/metas are
-- stamped. Invalid locked submissions are flagged instead.
--
-- The trigger function is SECURITY DEFINER so it can write the meta / reveal /
-- audit tables regardless of the caller's RLS permissions (just like the old
-- Cloud Function ran with admin privileges).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Safe public subset copied into lineup_submission_meta.
create or replace function public._lineup_safe_meta(sub jsonb, sid text, tid text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'scheduleId', sid,
    'teamId', tid,
    'opponentTeamId', coalesce(sub->>'opponentTeamId',''),
    'submissionStatus', sub->'submissionStatus',
    'submittedAt', sub->'submittedAt',
    'lockedAt', sub->'lockedAt',
    'unlockedAt', sub->'unlockedAt',
    'unlockedBy', sub->'unlockedBy',
    'unlockReason', sub->'unlockReason',
    'whatsappShared', coalesce((sub->>'whatsappShared')::boolean, false),
    'whatsappSharedAt', sub->'whatsappSharedAt',
    'validationErrors', case when jsonb_typeof(sub->'validationErrors')='array' then sub->'validationErrors' else '[]'::jsonb end,
    'convertedToScoreAt', sub->'convertedToScoreAt',
    'scoreSavedAt', sub->'scoreSavedAt',
    'scoreSavedBy', sub->'scoreSavedBy',
    'lastUpdatedAt', sub->'lastUpdatedAt',
    'version', sub->'version',
    'revealedAt', sub->'revealedAt',
    'revealId', sub->'revealId'
  );
$$;

-- Validate a single locked submission. Returns an array of error strings.
create or replace function public._lineup_validate_locked(sub jsonb, team jsonb, tid text, sid text, fixture jsonb)
returns text[] language plpgsql immutable as $$
declare
  errs text[] := '{}';
  lineup jsonb := coalesce(sub->'lineup', '[]'::jsonb);
  s_count int; d1_count int; d2_count int;
  s_line jsonb; d1_line jsonb; d2_line jsonb;
  slot_names text[] := '{}';
  nm text;
  roster text[];
begin
  if sub ? 'scheduleId' and (sub->>'scheduleId') <> sid then errs := errs || 'Submission scheduleId does not match path scheduleId'; end if;
  if sub ? 'teamId' and (sub->>'teamId') <> tid then errs := errs || 'Submission teamId does not match path teamId'; end if;
  if tid <> coalesce(fixture->>'team1Id','') and tid <> coalesce(fixture->>'team2Id','') then errs := errs || 'Team is not part of this scheduled match'; end if;

  select count(*) into s_count  from jsonb_array_elements(lineup) e where e->>'label' = 'S1';
  select count(*) into d1_count from jsonb_array_elements(lineup) e where e->>'label' = 'D1';
  select count(*) into d2_count from jsonb_array_elements(lineup) e where e->>'label' = 'D2';
  if s_count <> 1 or d1_count <> 1 or d2_count <> 1 then errs := errs || 'Lineup must include S1, D1, and D2 lines'; end if;

  select e into s_line  from jsonb_array_elements(lineup) e where e->>'label' = 'S1' limit 1;
  select e into d1_line from jsonb_array_elements(lineup) e where e->>'label' = 'D1' limit 1;
  select e into d2_line from jsonb_array_elements(lineup) e where e->>'label' = 'D2' limit 1;

  nm := trim(coalesce(s_line->'players'->>0,''));  if nm <> '' then slot_names := slot_names || nm; end if;
  nm := trim(coalesce(d1_line->'players'->>0,'')); if nm <> '' then slot_names := slot_names || nm; end if;
  nm := trim(coalesce(d1_line->'players'->>1,'')); if nm <> '' then slot_names := slot_names || nm; end if;
  nm := trim(coalesce(d2_line->'players'->>0,'')); if nm <> '' then slot_names := slot_names || nm; end if;
  nm := trim(coalesce(d2_line->'players'->>1,'')); if nm <> '' then slot_names := slot_names || nm; end if;

  if coalesce(array_length(slot_names,1),0) <> 5 then errs := errs || 'Lineup must include exactly 5 selected player slots'; end if;

  if (select count(distinct lower(x)) from unnest(slot_names) x) <> coalesce(array_length(slot_names,1),0) then
    errs := errs || 'A player cannot be selected in more than one lineup slot';
  end if;

  select array_agg(lower(trim(p->>'name')))
    into roster
    from jsonb_array_elements(coalesce(team->'players','[]'::jsonb)) p
   where coalesce(p->>'name','') <> '';
  roster := coalesce(roster, '{}');
  foreach nm in array slot_names loop
    if not (lower(nm) = any(roster)) then errs := errs || (nm || ' is not on the submitting team roster'); end if;
  end loop;

  if jsonb_array_length(coalesce(d1_line->'players','[]'::jsonb)) <> 2 then errs := errs || 'D1 must have exactly two players'; end if;
  if jsonb_array_length(coalesce(d2_line->'players','[]'::jsonb)) <> 2 then errs := errs || 'D2 must have exactly two players'; end if;

  select array_agg(distinct e) into errs from unnest(errs) e;
  return coalesce(errs, '{}');
end;
$$;

create or replace function public._lineup_mark_invalid(sid text, tid text, errs text[])
returns void language plpgsql as $$
declare now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  update public.lineup_submissions
     set data = data || jsonb_build_object('submissionStatus','validation_failed','validationErrors',to_jsonb(errs),'lockedAt',null,'lastUpdatedAt',now_ms),
         updated_at = now()
   where schedule_id = sid and team_id = tid;
  update public.lineup_submission_meta
     set data = data || jsonb_build_object('submissionStatus','validation_failed','validationErrors',to_jsonb(errs),'lockedAt',null,'lastUpdatedAt',now_ms),
         updated_at = now()
   where schedule_id = sid and team_id = tid;
  insert into public.audit_logs(id, data) values (
    now_ms::text || '-' || substr(md5(random()::text),1,8),
    jsonb_build_object('actionType','Lineup Validation Failed','performedByUserId','db-trigger','performedByName','Lineup Reveal Trigger','performedByRole','server','targetType','lineup','targetId', sid||':'||tid,'newValue', jsonb_build_object('validationErrors',to_jsonb(errs),'lastUpdatedAt',now_ms),'timestamp',now_ms)
  );
end;
$$;

create or replace function public._lineup_stamp_revealed(sid text, tid text, rid text, now_ms bigint)
returns void language plpgsql as $$
begin
  update public.lineup_submissions
     set data = data || jsonb_build_object('revealedAt',now_ms,'revealId',rid,'submissionStatus','revealed','lastUpdatedAt',now_ms),
         updated_at = now()
   where schedule_id = sid and team_id = tid;
  update public.lineup_submission_meta
     set data = data || jsonb_build_object('revealedAt',now_ms,'revealId',rid,'submissionStatus','revealed','lastUpdatedAt',now_ms),
         updated_at = now()
   where schedule_id = sid and team_id = tid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger function
-- ---------------------------------------------------------------------------
create or replace function public.reveal_lineups_on_lock()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  sid text; tid text; sub jsonb;
  fixture jsonb; team jsonb; errs text[];
  t1 text; t2 text; sub1 jsonb; sub2 jsonb; team1 jsonb; team2 jsonb;
  e1 text[]; e2 text[];
  existing_reveal text;
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  rid text; rcode text; rrec jsonb;
begin
  if TG_OP = 'DELETE' then
    delete from public.lineup_submission_meta where schedule_id = OLD.schedule_id and team_id = OLD.team_id;
    return OLD;
  end if;

  sid := NEW.schedule_id; tid := NEW.team_id; sub := NEW.data;

  insert into public.lineup_submission_meta(schedule_id, team_id, data)
  values (sid, tid, public._lineup_safe_meta(sub, sid, tid))
  on conflict (schedule_id, team_id) do update set data = excluded.data, updated_at = now();

  if (sub->>'lockedAt') is null or (sub->>'unlockedAt') is not null then
    return NEW;
  end if;

  select data into fixture from public.schedule where id = sid;
  if fixture is null or (fixture->>'team1Id') is null or (fixture->>'team2Id') is null then return NEW; end if;
  t1 := fixture->>'team1Id'; t2 := fixture->>'team2Id';

  select data into team from public.teams where id = tid;
  errs := public._lineup_validate_locked(sub, team, tid, sid, fixture);
  if array_length(errs,1) is not null then
    perform public._lineup_mark_invalid(sid, tid, errs);
    return NEW;
  end if;

  select data into sub1 from public.lineup_submissions where schedule_id = sid and team_id = t1;
  select data into sub2 from public.lineup_submissions where schedule_id = sid and team_id = t2;
  if sub1 is null or sub2 is null then return NEW; end if;
  if (sub1->>'lockedAt') is null or (sub2->>'lockedAt') is null
     or (sub1->>'unlockedAt') is not null or (sub2->>'unlockedAt') is not null then
    return NEW;
  end if;

  select data into team1 from public.teams where id = t1;
  select data into team2 from public.teams where id = t2;
  e1 := public._lineup_validate_locked(sub1, team1, t1, sid, fixture);
  e2 := public._lineup_validate_locked(sub2, team2, t2, sid, fixture);
  if array_length(e1,1) is not null or array_length(e2,1) is not null then
    if array_length(e1,1) is not null then perform public._lineup_mark_invalid(sid, t1, e1); end if;
    if array_length(e2,1) is not null then perform public._lineup_mark_invalid(sid, t2, e2); end if;
    return NEW;
  end if;

  existing_reveal := coalesce(sub1->>'revealId', sub2->>'revealId');
  if existing_reveal is not null then return NEW; end if;

  rid := sid || '-' || now_ms::text;
  rcode := upper(right(rid, 8));
  rrec := jsonb_build_object(
    'revealId', rid, 'scheduleId', sid, 'revealCode', rcode,
    'team1Id', t1, 'team2Id', t2, 'revealedAt', now_ms,
    'lineups', jsonb_build_object(
      t1, coalesce(sub1->'lineup','[]'::jsonb),
      t2, coalesce(sub2->'lineup','[]'::jsonb)
    )
  );
  insert into public.revealed_lineups(id, data) values (rid, rrec)
    on conflict (id) do update set data = excluded.data, updated_at = now();

  perform public._lineup_stamp_revealed(sid, t1, rid, now_ms);
  perform public._lineup_stamp_revealed(sid, t2, rid, now_ms);

  insert into public.audit_logs(id, data) values (
    now_ms::text || '-' || substr(md5(random()::text),1,8),
    jsonb_build_object('actionType','Lineups Revealed','performedByUserId','db-trigger','performedByName','Lineup Reveal Trigger','performedByRole','server','targetType','lineup','targetId', sid||':both','newValue', jsonb_build_object('revealId',rid,'revealCode',rcode,'revealedAt',now_ms,'lastUpdatedAt',now_ms),'timestamp',now_ms)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_reveal_lineups on public.lineup_submissions;
create trigger trg_reveal_lineups
  after insert or update or delete on public.lineup_submissions
  for each row execute function public.reveal_lineups_on_lock();
