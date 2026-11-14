-- Walk-ins can now come from either team. member_attendance_totals counted a
-- mark by the team of the EVENT, so a Team B member who walked in at a Team A
-- event showed up in Team A's totals and not in their own. This counts a mark
-- by the team of the MEMBER, so the walk-in lands on the right person's record.
-- Same columns and same arguments; only the join changes.
create or replace function public.member_attendance_totals(p_team text)
returns table(member_id bigint, present bigint, late bigint, excused bigint, absent bigint, marked bigint)
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select a.member_id,
         count(*) filter (where a.status = 'present') as present,
         count(*) filter (where a.status = 'late')    as late,
         count(*) filter (where a.status = 'excused') as excused,
         count(*) filter (where a.status = 'absent')  as absent,
         count(*) filter (where a.status is not null) as marked
    from public.iv_attendance a
    join public.iv_members m on m.id = a.member_id
   where m.team = p_team
   group by a.member_id
$$;
