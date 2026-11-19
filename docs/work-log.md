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
