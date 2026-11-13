-- Walk-in attendance: a Team Lead adds someone who turned up on the day in
-- uniform and was given a duty. Stored on the attendance mark only; the
-- roster and duty counts are not touched.
alter table public.iv_attendance
  add column if not exists walk_in      boolean not null default false,
  add column if not exists walk_in_duty text,
  add column if not exists in_uniform   boolean;

comment on column public.iv_attendance.walk_in      is 'Added on the day by a lead; not on the roster';
comment on column public.iv_attendance.walk_in_duty is 'Duty the walk-in did, as chosen or typed by the lead';
comment on column public.iv_attendance.in_uniform   is 'Lead confirmed the walk-in was in uniform';
