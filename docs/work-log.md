# IV Hub work log (plain English)

This log covers the recent redesign and hardening work on the live site (av-builds.github.io/ivhub) and its database. Everything below went into pull request #59 on the branch `claude/redesign-theme`, which you merge by hand.

## Features and fixes already finished and pushed

1. **Youth Congregation fix.** Found why the Youth Congregation toggle did not behave. The button now controls the MPH duties. Existing Fridays stay ON, and it applies to Fridays only.
2. **Walk-in attendance.** Team Leads can add people on the day while attendance is open. Anyone on either team can be added. Choosing a duty is optional. The lead ticks "In uniform". The person can be changed to Present later, and the entry is counted and tagged as a walk-in.
3. **AV Team top bar.** Rebuilt in the same style as Team A and B. My Duties and Duty Stats were removed completely. All six pages sit in order with shorter labels and the AV colour.
4. **Hub top bar.** Same block-and-dropdown style as the team pages, with the logo only, deep sea blue, fading on scroll, and buttons on the right.
5. **Full screen button.** Added to every page.
6. **Everything is a parallelogram.** Buttons, inputs, table rows, menus, dropdowns, the bell, search and the team switcher now use the slanted shape. The exceptions are profile pictures, the seal, status dots and checkboxes. The dropdown menus open as a stack of same-width slanted blocks that line up with the title.
7. **Test and build fix.** CI was crashing because the browser cache did not match, so the workflow now always installs the browser it needs.
8. **Sitewide type scale.** Text is lighter and larger in the same typeface. Capitals are kept with tamer letter spacing, and text is padded away from the slanted edges. Checked on laptop and phone, in dark and light.
9. **Visual audit fixes.** A page-by-page visual check turned up clipped dropdowns, light-theme colour problems, small phone tap targets and chip wrapping. All were fixed in a new shared style file, `ivfix.css`.
10. **My Profile page.** People can change their own name and details and manage their own away dates.

## Database changes already applied to production (all additive, no data deleted)

- Walk-in attendance support, and walk-in totals counted per member and team.
- Self-service profile functions for My Profile, including a safe rename.
- December 2026 events (9 added).

## Security and bug sweep

- **Sweep result:** the whole site was combed by several reviewers. 78 findings were confirmed after a second round of independent checking. About 4 were high, about 20 medium and the rest low.
- **High-severity items:**
  - Old plaintext passwords in the AV users table.
  - Every signed-in user being able to read all member contact details.
  - A roster save wrongly reported as failed.
  - A stored cross-site-scripting hole through the "away" dates.
- **Fixes are in progress now.** Six agents are working in parallel on separate files: the database, the invite-user function, the Hub page, the team pages, the AV and division pages, and the shared menu/theme/CI code. They had been stopped once by your usage limit and were restarted.

## Still to do

1. Collect the six agents' results, regenerate Team B from Team A, run the full test suite, and commit and push to PR #59.
2. Test every feature on the site and fix whatever fails.
3. Run a second full sweep after the fixes.

I will report honestly on what was fixed, what was skipped and why, and every database or function change I made.

## Update: fixes pushed, Satada built

- **Bug and security fixes.** The Hub, Team A and B, AV, division pages and shared code fixes are pushed. Examples are the roster save wrongly reported as failed, the away-date script injection, and the AV admin panel no longer reading passwords. The invite-user function is live as version 14, with throttled password resets and division roles.
- **Database.** Log entries are stamped with the real user. The old plaintext passwords are replaced with a placeholder. The rank function knows the division roles. The rest (team-scoped writes, checklist tables, and others) is waiting on a Supabase confirmation prompt.
- **Satada.** Either Team Lead can add a satada week (Sunday to Saturday) with an owner team per night. Both leads see all seven nights. Only the owner team rosters a night, and the other lead can take it over. The cycle's own Fridays and Paanch Baar Saal are not created that week. Friday keeps its MPH options. Satada nights count as normal majalis in attendance and reports.
- **Yearly roster.** From next year you send the jamati roster and I enter the majalis dates, including satada weeks.

## Update: Weekday Team Leads
- **Role and records.** A new Weekday Team Lead role, assignable by Facilitators on top of a normal role. Weekday attendance is kept in its own tables, separate from normal attendance.
- **Weekday page.** Leads search a name, pick a duty from the full list, and it is recorded as an Extra Duty. Duties a person cannot do are blocked. Several leads can share a day. Close Up asks for confirmation and submits; late edits are allowed until midnight.
- **Privacy.** A weekday lead sees only names, teams and cannot-do duties. The database blocks them from reading member, roster and attendance data.
- **Hub.** Facilitators and above get a Weekday Attendance page. Volunteers see an Extra duties line in My Profile and My Duties.
- **Team pages.** Cannot-do duties are set in each member's People profile. Attendance reports have an Extra Duty column.
- **Invite function.** Now at version 16, with the new role.

## Update: feature testing pass (Job 2)

Seven agents tested every feature area and fixed what failed. Fixed counts and the headline items:

### hub-accounts: 12 fixed, 5 left
- Sign-in could be double-fired, threw silently on a dropped connection (no message, unhandled rejection), accepted an empty password, said 'username' for an email field, and showed errors in green for 8s after using the reset link
- Session ending by itself (SIGNED_OUT event) left the previous person's member directory, accounts list, audit rows and typed password in memory/DOM for the next sign-in on that page
- Sign-out could hang forever when the audit write never returned (dead connection)
- An expired or already-used invite/reset link dropped the person on a bare sign-in box with no explanation and the error hash left in the URL
- Own row in Admin Logins was labelled 'outranks you'
- Invite User accepted invalid addresses like 'a b@c', and double click sent two invites (button label could also get stuck on 'Sending…')
- Account edit panel let you pick a person already linked to another login; the database unique index then failed with the unhelpful 'it already exists'
- Volunteer Logins saved a future or ancient date of birth (future DOB made them a 'child') and any text as a phone number; Data Management edit panel also accepted any phone text
- Data Management add member allowed 200-character names and silent exact duplicate names; deleting a member who has a login gave no hint the login stays
- My Profile: detail saves went to the server with bad email, phone or a future date of birth; rename had no length check and a raw TypeError when offline
- Top bar and profile role label depended on array order, so a Team A Lead who also holds Weekday Team Lead could read as 'Weekday Team Lead'
- At 390px Admin Logins and Account Linking scrolled sideways when a name or email had no break points (page width 794 and 782)

### hub-rosters: 6 fixed, 3 left
- Weekday Attendance page scrolled sideways by about 260px on a phone when a member name, duty or added-by name was long
- My Duties page overflowed horizontally (up to 600px) with long unbroken names, in the hero, summary line, duty cards and notes
- A failed duty read was cached indefinitely (including the no-connection warning), so duties stayed missing until a realtime event
- When duties could not be loaded, the dashboard said 'Nothing on your list yet', the dashboard My Duties card said 'No upcoming duties', and the search said 'Enjoy the break'
- Unguarded localStorage reads and writes (My Duties name, sign-out) throw in private windows or with blocked site data, breaking the search and sign-out
- After sign-out, Satada weeks, Weekday Attendance rows, cached duties and the home dashboard stayed in memory and in the DOM for the next person to sign in on the same page

### team-pages: 12 fixed, 4 left
- Double or rapid taps on an attendance button counted the mark twice in the lifetime totals (P then L quickly left present 1 and late 1 for one mark)
- Double press on Generate ran two builds at once, each saving its own random roster, so the screen and the database could hold different rosters
- Double click on Add Event could fire two inserts (second shows a duplicate error after success); double click on Post posted the announcement twice
- Toast after building one event showed HTML entities literally (Built Quiz &lt;b&gt;Night...) because esc() was applied to a textContent toast
- Walk-in dialog: after picking someone, typing a different name left the old person selected, so Add saved the wrong person
- Stand-in (volunteer) dashboard had dead or leaking buttons: Roster and Open announcements went nowhere, Export offered a roster export
- Cover panel text promised swapping people, which the panel cannot do
- Attendance list header said On duty tonight on past and future events
- Day dialog on the calendar could pop back open after being closed while the other team's day was still loading
- Away badge and Has away-dates filter counted past dates, so people looked unavailable forever
- Long duty names clipped in attendance rows at 390px, and P/L/J/N targets were small on touch
- Hero clock label clipped by the slanted corner on phones (stand-in dashboard)

### av: 12 fixed, 4 left
- nav() permission check used a one-argument _has, so developer perms were not seen as owner unless CU.role was set. It also read raw unnormalised perms, unlike applySession.
- Realtime change to the signed-in user's app_users row replaced CU.perms with the legacy list. That dropped profile-granted perms and could bounce a user to the Hub. The fall-back-to-dashboard check also ignored av_atl, av_yatl, av
- Day card view showed 'MPH congregation / Not assigned yet' on a Friday whose MPH was cancelled. It hid the MPH duty on a non-Friday day that an admin had given MPH, though the calendar cell showed it.
- Marking someone busy always toasted 'cover assigned' even when nobody could cover.
- A training could be created with the same person as trainee and trainer, and a second training could be added on a date that already had one. The duplicate was saved but hidden.
- Upcoming Majalis row showed a dangling ' · ' when the majalis has no time.
- A volunteer's 'Days done' counted future rostered days.
- A volunteer's 'My busy dates' ignored away dates they set in the Hub.
- Roster DELETE from another device was ignored when the local day was manual, leaving a stale lock. The Dashboard 'Next 7 days' did not refresh on any roster realtime event.
- DB Status and Regenerate buttons were shown to plain av_team volunteers.
- After ticking or unticking a weekday, the 'no availability' badge and counts in People did not refresh.
- Audit log entries could appear twice, because in-memory and DB timestamps differ in format ('Z' vs '+00:00') and the string comparison never matched.

### divisions: 11 fixed, 5 left
- Generated division pages did not load the shared css stack (ivshape, ivtype, ivfix, newer ivtheme version), so on phones the floating theme/fullscreen buttons covered the Hub button and the look differed from the rest of the site
- Page titles on phones were cut off with an ellipsis (SAFETY &..., ANCILLAR..., TRAINING & DEVELOP...)
- Division names containing & were written as raw & in title, heading and deny message
- Safety: People and numbers availability table overflowed the sheet on desktop with a long name (Fri to Sun hidden); on phones the weekday buttons were squashed and the Sunday one clipped by sitewide last-column padding
- Safety light mode: the remove (x) button on a person was invisible (white on white) and Reset this day was pale pink with poor contrast
- Safety: quickly clicking the month arrows let an older slower load overwrite a newer one, so grid and data could disagree
- Safety: double-clicking Add or Auto-fill sent duplicate or conflicting writes (a second Add used stale people and could drop the first)
- Safety: a roster row whose data lacked a people array (or was null) made opening that day throw
- Safety: if saving headcounts succeeded but availability failed, the headcounts were saved in the database but not shown
- Setup: pressing Enter repeatedly while saving fired several password updates; a later failed call could replace the success screen with the expired-link screen
- Setup: show-password eye button and Create account button were under 44px tall

### weekday-and-shared: 16 fixed, 3 left
- Phone header squashed: title shrank to 'W...' and subtitle wrapped in a 35px column because Hub, Sign out and the floating theme/full-screen buttons shared one row
- Team chip text (Team A / Team B / No team) was pale blue on white in light theme, nearly unreadable
- Stale response bug: switching the view day quickly let a slow earlier day overwrite the newer day's duties and lead banner
- Network exceptions (offline throw) from loadDay, search, add, remove, join and close-up were unhandled and could leave the Add button disabled or the page silent
- A failed day load showed the misleading 'No extra duties added on this day'
- Midnight rollover missed when viewing tomorrow's date (page became editable 'today' with stale data); sleeping phones and background tabs never rolled over or refreshed
- Past days said 'Not submitted yet. Close up when you are done.' and heading 'Today's extra duties' although they are read-only
- Same duty typed under Other in a different case (door greeter vs Door Greeter) created a near-duplicate row, and typing a duty key such as nandi_passing bypassed the cannot-do block
- Keyboard: choosing Other did not move focus to the text box, and Enter in it did nothing
- Focus was lost to the page body after Close Up submitted (the button hides)
- Duty dialog buttons were only reachable after scrolling the 23 option list on a phone
- Long unbroken names overflowed rows, options and toasts
- Duty text in each entry was squashed to 'Nand' because the class name .duty collides with the team pages' .duty rule
- Weekday search rows, entries, duty options, lead banner and read-only bar were still rounded boxes while everything else leans; Hub, Sign out, Join and Remove buttons showed no fill; light theme rows were invisible white on white
- JS error 'Failed to execute contains on Node' on every window resize while a popup was open, so resize did not close it
- Space key counted as a typeahead letter inside an open menu

### database-roles: 0 fixed, 6 left


## Update: second sweep (Job 3)
- **Sweep.** Eight reviewers combed the site again and every finding was independently challenged. 40 were confirmed.
- **Database fixes applied.**
  - A Weekday Team Lead who also holds a normal role keeps their duties, members and attendance.
  - Rosters are keyed by event, so two events on one day can each hold a roster.
  - Weekday attendance stamps can't be forged by editing a row.
  - Checklist ticks record the real signed-in user.
  - Weekday attendance now sends live updates.
- **Front-end fixes.**
  - A failed reload no longer wipes the team page.
  - Cards, rows and the AV sidebar work from the keyboard.
  - Nested dialogs and the Safety sheet manage focus properly.
  - Missing button labels were added.
  - Phone layout fixes on the weekday, Satada and roster pages, and the readability of the red cannot-do chip.
  - The weekday page no longer shows "Updated after close-up" after joining a shift.
  - The delete-member warning mentions weekday history.
  - Admin stats are paged.
  - The weekday-team tests run in CI.
- **Left for the owner.** Hiding members' phone, email, date of birth and notes from ordinary signed-in users; AV and division leads writing both teams' data; script signatures on the Supabase library; a per-address limit on password resets; closing anonymous database grants.
