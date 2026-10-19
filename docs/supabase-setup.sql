-- IV Hub — everything to run in the Supabase SQL editor, in order.
-- Safe to run more than once. No credentials belong in this file.
-- Run the sections one at a time (select the section, press Run).

-- ═══ 0. LOOK FIRST (read-only) ═══════════════════════════════════════════
-- Shows any CHECK constraints on the two tables that could reject the new
-- values. If either query returns a row mentioning `spec` or `perms`, tell me
-- what it says and I'll give you the exact change. No rows = nothing to do.
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'c'
  and conrelid in ('public.iv_members'::regclass, 'public.profiles'::regclass);

-- ═══ 1. VOLUNTEER LOGINS: date of birth and phone ════════════════════════
alter table public.iv_members
  add column if not exists dob date,
  add column if not exists phone text;

-- ═══ 2. SAFETY & SECURITY ROSTER ═════════════════════════════════════════
-- Who can do what (matches the site):
--   manage : Owner, Developer, Director, Deputy Director, PHMU Lead,
--            Safety & Security Lead (ss_lead) and Assistant Lead (ss_alead)
--   read   : managers, plus Safety & Security volunteers (ss_team)

-- Reads the caller's roles from profiles.perms, whether it is a text[],
-- a jsonb array, or a JSON string.
create or replace function public.safety_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce((
    select array(
      select jsonb_array_elements_text(
        case when jsonb_typeof(to_jsonb(p.perms)) = 'array' then to_jsonb(p.perms)
             else coalesce(nullif(to_jsonb(p.perms) #>> '{}', '')::jsonb, '[]'::jsonb) end))
    from public.profiles p where p.id = auth.uid()
  ), '{}'::text[]);
$$;

create or replace function public.safety_can_manage()
returns boolean language sql stable security definer set search_path = public as $$
  select public.safety_roles() && array['owner','developer','director','deputy_director','phmu_lead','iv_admin','ss_lead','ss_alead'];
$$;

create or replace function public.safety_can_read()
returns boolean language sql stable security definer set search_path = public as $$
  select public.safety_can_manage() or public.safety_roles() && array['ss_team'];
$$;

create table if not exists public.safety_roster (
  date date primary key,
  data jsonb not null default '{"people":[],"manual":false}'::jsonb
);
create table if not exists public.safety_settings (
  key text primary key,
  value jsonb not null
);
create table if not exists public.safety_avail (
  member_id bigint primary key,
  days text[] not null default '{Mon,Tue,Wed,Thu,Fri,Sat,Sun}'
);

alter table public.safety_roster   enable row level security;
alter table public.safety_settings enable row level security;
alter table public.safety_avail    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['safety_roster','safety_settings','safety_avail'] loop
    execute format('drop policy if exists %I on public.%I', t||'_read', t);
    execute format('drop policy if exists %I on public.%I', t||'_write', t);
    execute format('create policy %I on public.%I for select using (public.safety_can_read())', t||'_read', t);
    execute format('create policy %I on public.%I for all using (public.safety_can_manage()) with check (public.safety_can_manage())', t||'_write', t);
  end loop;
end $$;

-- The page reads the people directory to find who is ticked Safety & Security.
-- (Skip this one if Safety leads can already read iv_members.)
drop policy if exists safety_members_read on public.iv_members;
create policy safety_members_read on public.iv_members
  for select using (public.safety_can_manage());

-- ═══ 3. NOT SQL: the invite-user Edge Function ═══════════════════════════
-- The 23 new role keys (an_lead … cl_team, ss_lead/ss_alead, td_lead/td_alead,
-- pt_lead/pt_alead, mt_*, ck_*, cl_*, ab_*, sk_*) must also be added inside the
-- `invite-user` Edge Function (its list of valid roles and their ranks).
-- That is a code deploy, not SQL — see docs/new-team-roles.md for the list.
