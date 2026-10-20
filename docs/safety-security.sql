-- Safety & Security roster — run once in the Supabase SQL editor.
-- No credentials belong in this file. Safe to run more than once.
--
-- Who can do what (matches the site):
--   manage  : Owner, Developer, Director, Deputy Director, PHMU Lead,
--             Safety & Security Lead (ss_lead), Assistant Lead (ss_alead)
--   read    : managers, plus Safety & Security volunteers (ss_team)
-- The page only shows a volunteer their own duties; this policy lets them read
-- the table because Postgres cannot filter "rows that mention me" inside a JSON
-- blob cheaply. If you want strict row-level privacy, ask for a per-person table.

-- 1. A helper that reads the caller's roles from profiles.perms.
--    profiles.perms may be a text[] or a jsonb array; to_jsonb handles both.
create or replace function public.safety_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(
    (select array(select jsonb_array_elements_text(to_jsonb(p.perms))) from public.profiles p where p.id = auth.uid()),
    '{}'::text[]);
$$;

create or replace function public.safety_can_manage()
returns boolean language sql stable security definer set search_path = public as $$
  select public.safety_roles() && array['owner','developer','director','deputy_director','phmu_lead','iv_admin','ss_lead','ss_alead'];
$$;

create or replace function public.safety_can_read()
returns boolean language sql stable security definer set search_path = public as $$
  select public.safety_can_manage() or public.safety_roles() && array['ss_team'];
$$;

-- Signed-out callers have no use for these (every policy using them is for
-- signed-in users), and functions are executable by PUBLIC unless revoked.
revoke execute on function public.safety_roles()      from public, anon;
revoke execute on function public.safety_can_manage() from public, anon;
revoke execute on function public.safety_can_read()   from public, anon;
grant  execute on function public.safety_roles()      to authenticated;
grant  execute on function public.safety_can_manage() to authenticated;
grant  execute on function public.safety_can_read()   to authenticated;

-- 2. Tables.
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

-- 3. Row-level security.
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

-- 4. The page reads the people directory to find who is ticked Safety & Security.
--    Skip this if Safety leads can already read iv_members.
drop policy if exists safety_members_read on public.iv_members;
create policy safety_members_read on public.iv_members for select using (public.safety_can_manage());

-- 5. People ticked "Safety & Security" in Data Management (spec value 'SAFETY')
--    form the pool. If iv_members.spec has a CHECK constraint, allow 'SAFETY'.
