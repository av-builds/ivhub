-- Team page Checklist: one row per team per day, shared by the Team Lead and
-- Youth Team Lead so both see what has been cleared. Run in the Supabase SQL
-- editor. Safe to run twice.
--
-- The page works without this (it falls back to this phone only) but ticks are
-- not shared until the table and function exist.

create table if not exists public.iv_checklist (
  team       text not null check (team in ('A','B')),
  day        date not null,
  day_type   text not null default 'regular' check (day_type in ('regular','majalis')),
  done       text[] not null default '{}',
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (team, day)
);

alter table public.iv_checklist enable row level security;

-- Who may use the checklist for a given team: leadership, facilitators, and
-- that team's own Team Lead / Youth Team Lead.
create or replace function public.checklist_can(p_team text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select array(select jsonb_array_elements_text(to_jsonb(p.perms)))
       from public.profiles p where p.id = auth.uid()), '{}'::text[])
    && array['owner','developer','director','deputy_director','phmu_lead','iv_admin','facilitator',
             'tl_'||lower(p_team),'ytl_'||lower(p_team)];
$$;
revoke execute on function public.checklist_can(text) from public, anon;
grant  execute on function public.checklist_can(text) to authenticated;

drop policy if exists iv_checklist_read on public.iv_checklist;
create policy iv_checklist_read on public.iv_checklist
  for select using (public.checklist_can(team));

-- Writes go through this function so two people ticking at the same moment
-- cannot overwrite each other (each call adds or removes one key atomically).
create or replace function public.checklist_set(
  p_team text, p_day date,
  p_key text default null, p_done boolean default null,
  p_day_type text default null, p_by text default null)
returns public.iv_checklist language plpgsql security definer set search_path = public as $$
declare r public.iv_checklist;
begin
  if not public.checklist_can(p_team) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.iv_checklist(team, day) values (p_team, p_day)
    on conflict (team, day) do nothing;
  update public.iv_checklist c set
    done = case
      when p_key is null or p_done is null then c.done
      when p_done then (select coalesce(array_agg(distinct x), '{}') from unnest(c.done || p_key) x)
      else array_remove(c.done, p_key) end,
    day_type = coalesce(p_day_type, c.day_type),
    updated_by = coalesce(p_by, c.updated_by),
    updated_at = now()
  where c.team = p_team and c.day = p_day
  returning * into r;
  return r;
end $$;
revoke execute on function public.checklist_set(text,date,text,boolean,text,text) from public, anon;
grant  execute on function public.checklist_set(text,date,text,boolean,text,text) to authenticated;

-- Live updates between the TL's and ATL's phones.
do $$ begin
  alter publication supabase_realtime add table public.iv_checklist;
exception when duplicate_object then null; when undefined_object then null; end $$;
