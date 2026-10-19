# Backend checklist — everything Supabase needs, in order

**Shortcut:** steps 2–4 below are all in one file, [supabase-setup.sql](supabase-setup.sql). Run its sections one at a time.

Nothing here can be applied from the website. Run in the Supabase SQL editor /
Edge Functions. No credentials belong in this file.

1. **Role keys** — add the 23 division/team role keys to the `invite-user`
   Edge Function and to any rank helper or CHECK constraint on `profiles.perms`.
   Full list and ranks: [new-team-roles.md](new-team-roles.md).
2. **Team assignments** — if `iv_members.spec` is constrained, allow:
   `AV, ABESHAFA, SUKREET, TD, SAFETY, MAINTENANCE, COOKING, CLEANING`.
3. **Volunteer details** — one line:
   `alter table iv_members add column if not exists dob date, add column if not exists phone text;`
4. **Safety & Security roster** — run [safety-security.sql](safety-security.sql).
   Creates `safety_roster`, `safety_settings`, `safety_avail`, three helper
   functions and the row-level-security policies.

After each step the matching page stops showing its "not set up yet" note.

## Checking Safety & Security end to end

1. In Data Management, tick **Safety & Security** for a few volunteers.
2. In Admin Logins give a test account **Safety & Security Lead**.
3. Sign in as that account: it lands on the Safety & Security page. Press
   **People & numbers** to set how many people each weekday needs, then
   **Auto-fill month**. Click a day to add or remove people; hand changes lock
   the day so Auto-fill leaves it alone.
4. Give another test account **Safety & Security Volunteer** (and link it to its
   person in Admin Logins). It sees only its own upcoming duties, which also
   appear in My Duties and the saved picture.
