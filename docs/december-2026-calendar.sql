-- December 2026 occasions from the Auckland 2026 calendar (PDF), into iv_events.
--
-- Team follows the cycle: a cycle starts on Chandraat and the teams alternate.
-- Team A holds the cycle that ends on Dec 9 (Friday Majlis Dec 4 is already
-- Team A), so everything from Chandraat on Dec 9 is Team B, matching the
-- Team B Friday Majlis rows already in the table.
--
-- Naming follows the existing rows: a "(K)" Khushali Majlis in the PDF gets the
-- long Khushiyali name; none of December's are marked (K). Formal for Chandraat.
-- Safe to run twice: the (date, name) unique key skips anything already there.
-- Paanch Baar Saal on Dec 17 is already in the table and is skipped.

insert into public.iv_events (date, name, type, team, uniform, youth, confirmed) values
  ('2026-12-09', 'Chandraat',        'chandraat',     'B', 'Formal', false, false),
  ('2026-12-12', 'Baithulkhayal',    'baithulkhayal', 'B', 'Casual', false, false),
  ('2026-12-17', 'Paanch Baar Saal', 'pbs',           'B', 'Casual', false, false),
  ('2026-12-19', 'Student Majlis',   'student',       'B', 'Casual', false, false),
  ('2026-12-21', 'Yawm-i Ali',       'eid',           'B', 'Casual', false, false)
on conflict (date, name) do nothing;

-- Check:
-- select date, name, type, team, uniform from public.iv_events
--  where date between '2026-12-01' and '2026-12-31' order by date;
