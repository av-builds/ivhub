-- My Profile: a person edits their own display name and contact details.
-- Roles, rank, sign-in email and the linked person stay locked.

-- 1. Contact details. Writes only the member this account is linked to.
create or replace function public.set_my_details(
  p_phone text, p_email text, p_dob date, p_gender text
) returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  mid   bigint;
  who   text;
  mail  text := nullif(btrim(coalesce(p_email,'')), '');
  tel   text := nullif(btrim(coalesce(p_phone,'')), '');
  gen   text := nullif(btrim(coalesce(p_gender,'')), '');
  grp   text;
  years int;
  rec   jsonb;
begin
  select member_id, display into mid, who from public.profiles where id = auth.uid();
  if mid is null then
    raise exception 'Your account is not linked to a member yet. Ask your Team Lead.';
  end if;
  if mail is not null and mail !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email address does not look right.';
  end if;
  if tel is not null and tel !~ '^[0-9+()\-\s]{6,20}$' then
    raise exception 'That phone number does not look right.';
  end if;
  if gen is not null and lower(gen) not in ('male','female') then
    raise exception 'Gender must be Male or Female.';
  end if;
  if p_dob is not null then
    if p_dob > current_date or p_dob < current_date - interval '110 years' then
      raise exception 'That date of birth does not look right.';
    end if;
    years := extract(year from age(current_date, p_dob));
    grp := case when years < 12 then 'child' when years < 18 then 'youth' else 'adult' end;
  end if;

  update public.iv_members set
    phone     = tel,
    email     = mail,
    dob       = p_dob,
    gender    = coalesce(initcap(gen), gender),
    age_group = coalesce(grp, age_group)
  where id = mid
  returning to_jsonb(iv_members.*) into rec;

  -- Which fields were touched, never the values.
  insert into public.audit_logs(username, user_display, action, category, detail)
  select p.username, p.display, 'Updated own details', 'profile',
         'Changed contact details (phone, email, date of birth, gender)'
  from public.profiles p where p.id = auth.uid();

  return rec;
end $$;
revoke all on function public.set_my_details(text,text,date,text) from public, anon;
grant execute on function public.set_my_details(text,text,date,text) to authenticated;

-- 2. Display name. Audited as "old to new" so the log still shows who changed what.
create or replace function public.set_my_display(p_display text)
returns text
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  nm  text := btrim(coalesce(p_display,''));
  old text;
  usr text;
begin
  if char_length(nm) < 2 or char_length(nm) > 60 then
    raise exception 'A name needs 2 to 60 characters.';
  end if;
  select display, username into old, usr from public.profiles where id = auth.uid();
  if usr is null then raise exception 'No account found.'; end if;
  if old is not distinct from nm then return nm; end if;

  perform set_config('iv.self_rename', '1', true);   -- this transaction only
  update public.profiles set display = nm where id = auth.uid();

  insert into public.audit_logs(username, user_display, action, category, detail)
  values (usr, nm, 'Changed own display name', 'profile', coalesce(old,'') || ' to ' || nm);
  return nm;
end $$;
revoke all on function public.set_my_display(text) from public, anon;
grant execute on function public.set_my_display(text) to authenticated;

-- 3. Guard: keep new.display on a self-edit only when set_my_display raised the flag.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer
set search_path to 'public'
as $$
declare
  actor_rank int := public.my_rank();
  allowed    text[];
begin
  if coalesce(
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''
     ) = 'service_role' then
    return new;
  end if;

  if new.id = auth.uid() then
    new.perms     := old.perms;
    new.member_id := old.member_id;
    new.username  := old.username;
    new.email     := old.email;
    if coalesce(current_setting('iv.self_rename', true), '') <> '1' then
      new.display := old.display;
    end if;
    return new;
  end if;

  if actor_rank > 5 then
    raise exception 'You do not have permission to change other accounts.';
  end if;
  if actor_rank >= public.rank_of(old.perms) then
    raise exception 'That account is at or above your level in the chain of command.';
  end if;
  if public.rank_of(new.perms) <= actor_rank then
    raise exception 'You cannot grant a role at or above your own level.';
  end if;

  if actor_rank = 5 then
    allowed := array['tl_a','ytl_a','tl_b','ytl_b','team_a','team_b'];
    if exists (
      select 1 from jsonb_array_elements_text(coalesce(new.perms,'[]'::jsonb)) k
      where k <> all(allowed)
    ) then
      raise exception 'A Facilitator may only assign Team A and Team B roles.';
    end if;
  end if;

  return new;
end;
$$;
