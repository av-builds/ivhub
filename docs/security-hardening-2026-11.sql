-- IV Hub database hardening, November 2026. Every block is idempotent. Block 1 was
-- applied to production; later blocks carry their own STATUS line. All changes are backward
-- compatible with the deployed front-end (select('*'), existing RPC names and
-- signatures, the invite-user request/response shape). Nothing here deletes
-- rows or drops tables, columns, functions or policies the pages rely on.

-- ===================================================================
-- 1. audit_logs / view_logs: the identity columns come from the session
-- ===================================================================
-- Before, any signed-in user could insert a row attributed to someone else.
-- The BEFORE INSERT trigger now overwrites username, user_display, user_email
-- (and ts) with the caller's true values. When there is no signed-in caller
-- (service_role from the invite-user edge function, where auth.uid() is null)
-- the values supplied by that trusted code are kept. The insert policy and the
-- client insert shape are unchanged.
create or replace function public.stamp_log_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p record;
begin
  if auth.uid() is null then
    new.user_email := coalesce(auth.jwt() ->> 'email', new.user_email, '');
    return new;
  end if;
  select username, display, email into p from public.profiles where id = auth.uid();
  new.user_email := coalesce(auth.jwt() ->> 'email', p.email, '');
  if p.username is not null then
    new.username     := p.username;
    new.user_display := coalesce(p.display, p.username);
  else
    new.username     := new.user_email;
    new.user_display := new.user_email;
  end if;
  new.ts := now();
  return new;
end $$;
revoke execute on function public.stamp_log_email() from public, anon, authenticated;

-- ===================================================================
-- 2. app_users: legacy plaintext passwords neutralised, owner tier only
-- STATUS: NOT YET APPLIED. The Supabase tool asked for confirmation of this
-- data-changing statement and nobody answered, so it was left alone.
-- ===================================================================
-- The legacy login is gone, but av.html still filters rows on a truthy pw, so
-- the column keeps a placeholder instead of NULL. Realtime publication is left
-- as is (the pages subscribe; with no secret left in the rows it leaks nothing
-- and Realtime already honours RLS).
update public.app_users set pw = '-' where pw is distinct from '-';
drop policy if exists app_users_read on public.app_users;
create policy app_users_read on public.app_users for select to authenticated
  using (public.my_rank() <= 2);
drop policy if exists app_users_write on public.app_users;
create policy app_users_write on public.app_users for all to authenticated
  using (public.my_rank() <= 2) with check (public.my_rank() <= 2);
