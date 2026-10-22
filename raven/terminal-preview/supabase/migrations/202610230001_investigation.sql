-- Only the authenticated Edge Function may change ranked results.
-- The browser gets owner-scoped save/run reads and a sanitized public leaderboard.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alias text check (char_length(alias) between 3 and 24 and alias !~ '[<>[:cntrl:]]'),
  updated_at timestamptz not null default now()
);
create table public.case_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  ruleset text not null check (ruleset = 'case-017-expansion-v3'),
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, ruleset)
);
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ruleset text not null check (ruleset = 'case-017-expansion-v3'),
  status text not null default 'active' check (status in ('active','completed','abandoned')),
  seq bigint not null default 0 check (seq >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  hint_count integer not null default 0 check (hint_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  elapsed_ms bigint,
  updated_at timestamptz not null default now()
);
create unique index raven_one_active_run on public.runs(user_id, ruleset) where status = 'active';
create table public.run_events (
  run_id uuid not null references public.runs(id) on delete cascade,
  request_id uuid not null,
  seq bigint not null,
  kind text not null check (kind in ('view','submit','hint','abandon')),
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (run_id, request_id),
  unique (run_id, seq)
);
create table public.leaderboard_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  ruleset text not null,
  run_id uuid not null references public.runs(id) on delete cascade,
  alias text not null check (char_length(alias) between 3 and 24 and alias !~ '[<>[:cntrl:]]'),
  hint_count integer not null,
  wrong_count integer not null,
  elapsed_ms bigint not null,
  completed_at timestamptz not null,
  is_public boolean not null default true,
  primary key (user_id, ruleset)
);

alter table public.profiles enable row level security;
alter table public.case_saves enable row level security;
alter table public.runs enable row level security;
alter table public.run_events enable row level security;
alter table public.leaderboard_entries enable row level security;
create policy profiles_owner_read on public.profiles for select to authenticated using (auth.uid() = user_id);
create policy saves_owner_read on public.case_saves for select to authenticated using (auth.uid() = user_id);
create policy runs_owner_read on public.runs for select to authenticated using (auth.uid() = user_id);
create policy events_owner_read on public.run_events for select to authenticated using (
  exists(select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid())
);
create policy entries_owner_read on public.leaderboard_entries for select to authenticated using (auth.uid() = user_id);
revoke all on public.profiles, public.case_saves, public.runs, public.run_events, public.leaderboard_entries from anon, authenticated;
grant select on public.profiles, public.case_saves, public.runs, public.run_events, public.leaderboard_entries to authenticated;
grant all on public.profiles, public.case_saves, public.runs, public.run_events, public.leaderboard_entries to service_role;

-- Owner-executed view exposes no account IDs, emails, saves, or answers.
create view public.raven_leaderboard as
 select row_number() over (partition by ruleset order by hint_count, wrong_count, elapsed_ms, completed_at, run_id) as rank,
        alias, ruleset, hint_count, wrong_count, elapsed_ms, completed_at
 from public.leaderboard_entries where is_public;
revoke all on public.raven_leaderboard from public;
grant select on public.raven_leaderboard to anon, authenticated, service_role;

create function public.raven_run_payload(r public.runs) returns jsonb
language sql stable set search_path = public, pg_temp as $$
 select r.state || jsonb_build_object(
   'status', r.status,
   'progress', coalesce(r.state->'progress', '{}'::jsonb) || jsonb_build_object(
     'revision', r.ruleset, 'mode', 'ranked', 'runId', r.id, 'seq', r.seq,
     'wrongSubmissions', r.wrong_count, 'hintCount', r.hint_count,
     'startedAt', floor(extract(epoch from r.started_at) * 1000),
     'completedAt', case when r.completed_at is null then null else floor(extract(epoch from r.completed_at) * 1000) end,
     'elapsedMs', coalesce(r.elapsed_ms, floor(extract(epoch from (statement_timestamp() - r.started_at)) * 1000)::bigint)
   ));
$$;

create function public.raven_start_run(p_user_id uuid, p_ruleset text, p_state jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.runs;
begin
 if p_ruleset <> 'case-017-expansion-v3' or coalesce(jsonb_array_length(p_state#>'{progress,accepted}'),0) <> 0 then
   raise exception 'RAVEN_INVALID: fresh supported ruleset required';
 end if;
 select * into r from public.runs where user_id=p_user_id and ruleset=p_ruleset and status='active';
 if found then return public.raven_run_payload(r); end if;
 begin
   insert into public.runs(user_id,ruleset,state) values(p_user_id,p_ruleset,p_state) returning * into r;
 exception when unique_violation then
   select * into r from public.runs where user_id=p_user_id and ruleset=p_ruleset and status='active';
 end;
 return public.raven_run_payload(r);
end $$;

create function public.raven_get_run(p_user_id uuid, p_run_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.runs;
begin
 select * into r from public.runs where id=p_run_id and user_id=p_user_id;
 if not found then raise exception 'RAVEN_NOT_FOUND: run'; end if;
 return public.raven_run_payload(r);
end $$;

create function public.raven_event_result(p_user_id uuid, p_run_id uuid, p_request_id uuid) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
 select e.result from public.run_events e join public.runs r on r.id=e.run_id
 where r.user_id=p_user_id and e.run_id=p_run_id and e.request_id=p_request_id;
$$;

create function public.raven_apply_event(
 p_user_id uuid, p_run_id uuid, p_request_id uuid, p_expected_seq bigint,
 p_kind text, p_state jsonb, p_outcome jsonb,
 p_hint_delta integer default 0, p_wrong_delta integer default 0, p_complete boolean default false
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.runs; cached jsonb; response jsonb; old_count integer; next_count integer;
begin
 select * into r from public.runs where id=p_run_id and user_id=p_user_id for update;
 if not found then raise exception 'RAVEN_NOT_FOUND: run'; end if;
 -- Retry must return its original outcome even after finish or a later sequence.
 select result into cached from public.run_events where run_id=p_run_id and request_id=p_request_id;
 if found then return cached; end if;
 if r.seq <> p_expected_seq then raise exception 'RAVEN_CONFLICT: reload run'; end if;
 if r.status <> 'active' then raise exception 'RAVEN_CLOSED: run'; end if;
 if p_kind not in ('view','submit','hint','abandon') or p_hint_delta not between 0 and 1 or p_wrong_delta not between 0 and 1 then
   raise exception 'RAVEN_INVALID: event';
 end if;
 old_count := coalesce(jsonb_array_length(r.state#>'{progress,accepted}'),0);
 next_count := coalesce(jsonb_array_length(p_state#>'{progress,accepted}'),0);
 if next_count < old_count or next_count > old_count+1 or next_count > 32 then
   raise exception 'RAVEN_INVALID: sequential completion required';
 end if;
 if next_count = old_count+1 and (p_kind <> 'submit' or coalesce((p_outcome->>'correct')::boolean,false) is not true
      or p_state#>>array['progress','accepted',old_count::text,'activityId'] <> 'A'||lpad((old_count+1)::text,2,'0')) then
   raise exception 'RAVEN_INVALID: next activity required';
 end if;
 if p_complete and (next_count <> 32 or p_kind <> 'submit' or next_count <> old_count+1) then
   raise exception 'RAVEN_INVALID: finish requires all activities';
 end if;
 update public.runs set state=p_state, seq=seq+1,
   hint_count=hint_count+p_hint_delta, wrong_count=wrong_count+p_wrong_delta,
   status=case when p_kind='abandon' then 'abandoned' when p_complete then 'completed' else status end,
   completed_at=case when p_complete then clock_timestamp() else completed_at end,
   elapsed_ms=case when p_complete then greatest(0,floor(extract(epoch from(clock_timestamp()-started_at))*1000)::bigint) else elapsed_ms end,
   updated_at=clock_timestamp() where id=r.id returning * into r;
 response := public.raven_run_payload(r) || jsonb_build_object('result',p_outcome);
 insert into public.run_events(run_id,request_id,seq,kind,result) values(r.id,p_request_id,r.seq,p_kind,response);
 return response;
end $$;

create function public.raven_save_case(p_user_id uuid,p_ruleset text,p_expected_revision bigint,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.case_saves;
begin
 if p_ruleset <> 'case-017-expansion-v3' or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text)>262144
    or coalesce(p_payload#>>'{progress,mode}','practice') <> 'practice' then
   raise exception 'RAVEN_INVALID: practice save';
 end if;
 -- Lock per owner/ruleset, including the first insert.
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_ruleset,0));
 select * into s from public.case_saves where user_id=p_user_id and ruleset=p_ruleset for update;
 if found then
   if s.revision <> p_expected_revision then raise exception 'RAVEN_CONFLICT: cloud save'; end if;
   update public.case_saves set payload=p_payload, revision=revision+1, updated_at=clock_timestamp()
    where user_id=p_user_id and ruleset=p_ruleset returning * into s;
 else
   if p_expected_revision <> 0 then raise exception 'RAVEN_CONFLICT: cloud save missing'; end if;
   insert into public.case_saves(user_id,ruleset,payload) values(p_user_id,p_ruleset,p_payload) returning * into s;
 end if;
 return jsonb_build_object('revision',s.revision,'payload',s.payload,'updatedAt',s.updated_at);
end $$;

create function public.raven_load_case(p_user_id uuid,p_ruleset text) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('revision',revision,'payload',payload,'updatedAt',updated_at)
 from public.case_saves where user_id=p_user_id and ruleset=p_ruleset;
$$;

create function public.raven_publish_run(p_user_id uuid,p_run_id uuid,p_alias text,p_public boolean default true) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.runs; e public.leaderboard_entries; name text := btrim(p_alias);
begin
 select * into r from public.runs where id=p_run_id and user_id=p_user_id for update;
 if not found then raise exception 'RAVEN_NOT_FOUND: run'; end if;
 if r.status <> 'completed' or coalesce(jsonb_array_length(r.state#>'{progress,accepted}'),0) <> 32 then
   raise exception 'RAVEN_INVALID: completed run required';
 end if;
 if char_length(name) not between 3 and 24 or name ~ '[<>[:cntrl:]]' then raise exception 'RAVEN_INVALID: alias'; end if;
 insert into public.profiles(user_id,alias) values(p_user_id,name)
 on conflict(user_id) do update set alias=excluded.alias,updated_at=clock_timestamp();
 if not p_public then
   update public.leaderboard_entries set is_public=false where user_id=p_user_id and ruleset=r.ruleset;
   return jsonb_build_object('published',false);
 end if;
 insert into public.leaderboard_entries(user_id,ruleset,run_id,alias,hint_count,wrong_count,elapsed_ms,completed_at,is_public)
 values(p_user_id,r.ruleset,r.id,name,r.hint_count,r.wrong_count,r.elapsed_ms,r.completed_at,true)
 on conflict(user_id,ruleset) do update set
   run_id=excluded.run_id,alias=excluded.alias,hint_count=excluded.hint_count,wrong_count=excluded.wrong_count,
   elapsed_ms=excluded.elapsed_ms,completed_at=excluded.completed_at,is_public=true
 where (excluded.hint_count,excluded.wrong_count,excluded.elapsed_ms,excluded.completed_at)
     <= (leaderboard_entries.hint_count,leaderboard_entries.wrong_count,leaderboard_entries.elapsed_ms,leaderboard_entries.completed_at);
 -- Visibility and chosen alias apply to the best result even when this run is worse.
 update public.leaderboard_entries set alias=name,is_public=true where user_id=p_user_id and ruleset=r.ruleset;
 select * into e from public.leaderboard_entries where user_id=p_user_id and ruleset=r.ruleset;
 return jsonb_build_object('published',e.is_public,'bestRunId',e.run_id,'alias',e.alias);
end $$;

-- Postgres grants new functions EXECUTE to PUBLIC by default: revoke explicitly.
revoke all on function public.raven_run_payload(public.runs) from public,anon,authenticated;
revoke all on function public.raven_start_run(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.raven_get_run(uuid,uuid) from public,anon,authenticated;
revoke all on function public.raven_event_result(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.raven_apply_event(uuid,uuid,uuid,bigint,text,jsonb,jsonb,integer,integer,boolean) from public,anon,authenticated;
revoke all on function public.raven_save_case(uuid,text,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.raven_load_case(uuid,text) from public,anon,authenticated;
revoke all on function public.raven_publish_run(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.raven_run_payload(public.runs),public.raven_start_run(uuid,text,jsonb),public.raven_get_run(uuid,uuid),public.raven_event_result(uuid,uuid,uuid),public.raven_apply_event(uuid,uuid,uuid,bigint,text,jsonb,jsonb,integer,integer,boolean),public.raven_save_case(uuid,text,bigint,jsonb),public.raven_load_case(uuid,text),public.raven_publish_run(uuid,uuid,text,boolean) to service_role;
