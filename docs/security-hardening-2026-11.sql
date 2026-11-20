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

-- ===================================================================
-- NOTE on block 2 above: the pw neutralisation (pw = '-') is APPLIED (0 rows differ).
-- The app_users policies on live are can_manage_accounts() for select/all and were
-- deliberately NOT tightened (live main still needs them). The policy statements
-- in block 2 are intentionally not applied.
-- ===================================================================

-- ===================================================================
-- 3. rank_of(jsonb): division roles (mirrors defRole/PERM_RANK in index.html)
-- STATUS: APPLIED (migration hardening_01_rank_of_division_roles)
-- ===================================================================
-- xx_lead -> 6, xx_alead -> 7 for pt,td,ss,an,ab,sk,mt,ck,cl; ab/sk/mt/ck/cl _team -> 10.
-- index.html defines no xx_vol key and no _team for the four divisions, so none added.
-- Everything else in the function is unchanged.

-- ===================================================================
-- 4. docs/checklist.sql (iv_checklist, checklist_can, checklist_set)
-- STATUS: NOT APPLIED. apply_migration (hardening_02_checklist) was held for a
-- confirmation that nobody answered and timed out. Verified afterwards that
-- iv_checklist and both functions do not exist. Steps 3-12 not started.
-- ===================================================================

-- ===================================================================
-- APPLIED to production (migrations hardening_02 to hardening_04, plus the app_users pw neutralise):
--  * app_users.pw set to '-' on every row (policies left as they were: the live pages still read the table).
--  * iv_checklist, checklist_can, checklist_set created (docs/checklist.sql).
--  * rank_of knows the division roles (hardening_01).
--  * can_edit_team(text): rank <= 5 anywhere; rank 6 to 8 holding tl_/ytl_ of one team only that team; other
--    rank 6 to 8 roles (AV, division leads) unchanged. iv_members, iv_events, iv_roster, iv_attendance write
--    policies use it (rosters and attendance by their event's team, so a satada night follows its owner team).
--    Simulated as tl_a, tl_b, facilitator, volunteer inside a rolled-back block: leads write only their team,
--    facilitators both, volunteers none.
--  * roster_seen and member_attendance_totals: leaders only (volunteers see only their own row).
--  * iv_members.away CHECK (array of YYYY-MM-DD strings); deleting a member unlinks profiles.member_id.
--  * profiles read policies: own row, rank <= 5 (existing admin policy) or rank <= 8; the two read-all policies dropped.
--  * TRUNCATE, TRIGGER, REFERENCES revoked from anon and authenticated.
-- NOT applied: app_users policy tightening (live pages read it), iv_roster primary key move to event_id,
-- anon privilege revoke (some policies are TO public). Dashboard-only: leaked-password protection, shorter OTP expiry.

-- ===================================================================
-- APPLIED (weekday_team_leads, low_risk_followups, sweep2_database_fixes)
-- weekday_team_leads: rank_of knows wd_tl (rank 9); is_wd(); nz_today(); tables iv_wd_shifts and iv_wd_attendance
--   with RLS (read for leaders, weekday leads and a volunteer's own rows; write for facilitator+ or a weekday lead on
--   today's NZ date); stamp trigger; wd_member_search(q) (names, team, cannot-do duties only); restrictive read
--   policies so a weekday lead cannot read member, roster or attendance data; guard allows facilitators to assign wd_tl.
-- low_risk_followups: app_settings_write also for is_av_admin(); set_my_away uses nz_today(); duplicate profile
--   self-update policies dropped; auth.uid() wrapped in selects on profiles, log and cover policies.
-- sweep2_database_fixes: is_pure_wd() (the restriction now applies only to a weekday lead with no other normal role);
--   iv_roster primary key moved from date to event_id (two events on one day can each hold a roster; date has a plain
--   index); iv_wd_att_freeze and iv_wd_shift_stamp triggers (stamps cannot be forged by UPDATE); iv_wd_shifts.edited_at;
--   checklist_set ignores the client-supplied name; iv_wd_attendance added to the realtime publication.
-- STILL OPEN (owner decision): hide member phone/email/dob/notes from ordinary signed-in users (needs a directory view
--   first); AV and division leads can write both teams' data; anon DML grants; per-address limit on password reset.

-- ===================================================================
-- APPLIED: scope_writes_to_team_leads
-- AV and division pages only READ iv_members (checked: no writes to iv_members, iv_events, iv_roster, iv_attendance,
-- iv_settings or announcements from av.html, safety.html or any division page), so those roles no longer write team data.
--  * is_team_lead(); can_edit_team(t) = rank <= 5, or a Team Lead / Youth Team Lead of team t.
--  * announcements_write uses can_edit_team(team).
--  * iv_settings_write: rank <= 5, or a team lead for any key except 'anchor', with auto_skip_<team> limited to that team.
--  * app_settings_write unchanged (AV pages write it).
-- Simulated (rolled back): tl_a writes team A only, tl_b team B only, ytl_a team A, facilitator both and the anchor;
-- an_lead, av_yatl, av_coord and a volunteer write none of it; AV roles keep app_settings.
-- STILL OPEN: hide member contact details and notes from ordinary signed-in users (little data today: 1 email, 10 notes);
-- anon DML grants; per-address limit on password reset; script signatures on the Supabase library.
