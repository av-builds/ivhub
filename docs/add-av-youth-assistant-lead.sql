-- IV Hub: new role "AV Youth Assistant Lead" (key av_yatl).
-- Same permissions as AV Assistant Lead (av_atl), one step lower in the chain of command.
-- New ranks: av_atl 7 -> av_yatl 8 -> av_coord 9 -> volunteers 10 (were 8 and 9).
create or replace function public.rank_of(p jsonb)
 returns integer
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(min(r), 99) from (
    select case k
      when 'owner' then 0
      when 'developer' then 1
      when 'director' then 2 when 'iv_admin' then 2
      when 'deputy_director' then 3
      when 'phmu_lead' then 4
      when 'facilitator' then 5
      when 'tl_a' then 6 when 'tl_b' then 6 when 'av_admin' then 6
      when 'ytl_a' then 7 when 'ytl_b' then 7 when 'av_atl' then 7
      when 'av_yatl' then 8
      when 'av_coord' then 9
      when 'team_a' then 10 when 'team_b' then 10 when 'av_team' then 10
      else 99 end as r
    from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) as k
  ) t;
$function$;

create or replace function public.is_av_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$ select public.is_admin() or public.my_perms() ?| array['av_admin','av_atl','av_yatl','av_coord'] $function$;

create or replace function public.my_log_teams()
 returns text[]
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select array_remove(array[
    case when public.my_rank() <= 5 then 'Hub' end,
    case when public.my_rank() <= 5 then 'A'   end,
    case when public.my_rank() <= 5 then 'B'   end,
    case when public.my_rank() <= 4
           or public.my_perms() ?| array['av_admin','av_atl','av_yatl'] then 'AV' end
  ], null)
$function$;

create or replace function public.my_prepare_teams()
 returns text[]
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select array_remove(array[
    case when public.my_rank() <= 5 or public.my_perms() ?| array['tl_a','ytl_a']       then 'A'  end,
    case when public.my_rank() <= 5 or public.my_perms() ?| array['tl_b','ytl_b']       then 'B'  end,
    case when public.my_rank() <= 4 or public.my_perms() ?| array['av_admin','av_atl','av_yatl']  then 'AV' end
  ], null)
$function$;

-- roster editing was rank <= 7 (Leads and Assistant Leads); the new role sits at 8 and needs it too
create or replace function public.can_edit_roster()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$ select public.my_rank() <= 8 $function$;
