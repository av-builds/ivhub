-- Supabase security advisor fixes — run once in the Supabase SQL editor.
-- No credentials belong in this file. Safe to run more than once.
--
-- 1. audit_logs / view_logs: INSERT policies were WITH CHECK (true).
-- 2. safety_* helpers: anon could call them through /rest/v1/rpc.
--
-- What is deliberately NOT changed, and why, is at the bottom.

-- 1. Log inserts ------------------------------------------------------------
-- Any signed-in user may still write a log row (every page does, and a Team
-- Lead who cannot read the log must still be able to append to it). What
-- changes: the caller must actually be signed in, and the address stored on
-- the row comes from the session token, so a row cannot name someone else.
-- The pages keep sending user_email; the trigger simply overrides it.
create or replace function public.stamp_log_email()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.user_email := coalesce(auth.jwt() ->> 'email', new.user_email, '');
  return new;
end $$;
revoke execute on function public.stamp_log_email() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['audit_logs','view_logs'] loop
    execute format('drop trigger if exists stamp_email on public.%I', t);
    execute format('create trigger stamp_email before insert on public.%I
                    for each row execute function public.stamp_log_email()', t);
    execute format('drop policy if exists %I on public.%I', t||'_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated
                    with check (auth.uid() is not null)', t||'_insert', t);
  end loop;
end $$;

-- 2. Safety helpers: signed-out callers ---------------------------------------
-- New functions are executable by PUBLIC by default, which is how anon got in.
-- Policies on safety_* only apply to signed-in users, so anon never needed them.
revoke execute on function public.safety_roles()      from public, anon;
revoke execute on function public.safety_can_manage() from public, anon;
revoke execute on function public.safety_can_read()   from public, anon;
grant  execute on function public.safety_roles()      to authenticated;
grant  execute on function public.safety_can_manage() to authenticated;
grant  execute on function public.safety_can_read()   to authenticated;

-- 3. profiles was readable by anyone holding the public key ------------------
-- Two SELECT policies were USING (true) for role public, so a signed-out
-- visitor could list every volunteer's email, username, perms and last_seen.
-- Every page reads profiles only after sign-in, so limit them to signed-in
-- users. (alter policy, not drop/create: the latter hung through the SQL API.)
alter policy "Users can read all profiles" on public.profiles to authenticated;
alter policy "profiles readable"           on public.profiles to authenticated;
revoke execute on function public.member_attendance_totals(text) from public, anon;
grant  execute on function public.member_attendance_totals(text) to authenticated;

-- Check: nothing below should list anon any more.
-- select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_can
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.prosecdef order by 1;

-- NOT changed (the remaining "signed-in users can execute" warnings):
--  * my_member, my_member_view, my_attendance_totals, roster_seen,
--    set_my_away, touch_last_seen are called by the pages with sb.rpc(...)
--    and act on auth.uid(). They need to be callable. The warning is expected.
--  * is_admin, is_av_admin, has_perm, can_edit_roster, can_manage_accounts,
--    my_perms, my_rank, my_approve_teams, my_log_teams, my_prepare_teams and
--    safety_* are used inside RLS policies. Postgres runs a policy's function
--    as the querying role, so revoking EXECUTE from authenticated would make
--    every table they guard refuse all reads and writes. They only return
--    facts about the caller, so being callable leaks nothing new.
--    The clean fix is to move them to a non-exposed schema; that needs their
--    bodies and the policies that call them checked first, so do it as its own
--    step rather than blind.
--
-- Dashboard only (Authentication settings, not SQL):
--  * Email OTP expiry: set to 3600 seconds or less (900 is typical).
--  * Leaked password protection: Authentication > Providers > Email. This
--    needs the Pro plan; on Free the warning cannot be cleared.
