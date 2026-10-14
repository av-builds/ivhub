---
name: iv-hub
description: Work on IV Hub, the volunteer rostering site for Ismaili Volunteers at Auckland Jamatkhana (static HTML on GitHub Pages plus Supabase). Use for any change to index.html, teama.html, teamb.html or av.html, including rostering, the calendar, permissions, the AV page, tests or deployment.
---

# IV Hub

Live at `av-builds.github.io/ivhub`. Supabase project `ysmkqvceezrjcrlixlii`.
Static HTML, no build step, no modules. Keep it that way: the owner edits by
uploading files, and a change that needs compiling breaks that.

## Files
| File | What it is |
|---|---|
| `index.html` | The Hub: sign-in, dashboard, My Duties, I'm Away, My Team, user and account management, invitations, Duty Stats, audit logs |
| `teama.html` | Team A app (roster, calendar, attendance, numbers, people, announcements) |
| `teamb.html` | **Generated. Never edit.** `sed "s/^const PAGE_TEAM='A';$/const PAGE_TEAM='B';/" teama.html > teamb.html` after every change to teama.html |
| `av.html` | AV Team calendar and roster. A separate app with its own design |
| `tests/verify.cjs` | Regression suite. `npm install && npx playwright install chromium && npm test` |
| `.github/workflows/verify.yml` | Runs the suite on push and PR |

## Rules from the owner (do not break)
- **AV is protected.** Leave `av.html` alone unless asked directly. The only approved change is the calendar cell redesign and what was asked after it.
- **Credentials never appear in chat, commits or code.** The anon key in the HTML is public by design (role=anon); security is RLS. There is no service-role key anywhere. Never add one.
- **Send individual files, never zips.**
- Audit log is append-only; only the Owner may clear it. `app_users` is readable only by account managers. Do not reinstate wide-open RLS policies.
- Do not put model names in commits, PR text or code comments.
- Do not open a PR unless asked.

## Product decisions already made
- **Team pages are leaders-only.** Volunteers use the Hub (My Duties, I'm Away, My Team). A volunteer with no cover gets a "Leaders only" screen. Stand-ins keep a Covering page (`dashboard`). Cover handling for plain volunteers is deliberately undecided; leave it working as is.
- Team page menu is one flat list: Calendar, Roster, Attendance, Numbers, People, Announcements. **The calendar is the landing page.** The old dashboard is retired; its reminders live in the Needs attention bell.
- Calendar events show Not built / Draft / On the calendar plus "N short". The other team's days are dimmed. A Tonight strip shows on event days.
- Facilitators and above get a Team A/B switcher that keeps the current page (`?p=`).
- A roster with gaps can be put on the calendar by a deliberate press (`publishIfComplete(ev,{force:true})`). **Automatic publishes (build, edit) must stay gated.** Volunteers see empty space, not UNASSIGNED.
- Building a cycle re-rolls only drafts. Events on the calendar are skipped unless the lead ticks the opt-in. Asking for one event by name always rebuilds it.
- Member details can be edited from the Hub or the team page; both write the same `iv_members` row.
- Away dates stay with the member (Hub) and the team page. Not duplicated.
- Volunteers do not read announcements; leaders post for other channels.

## Roles (perms arrays on `profiles`)
`IV_TOP` = owner, developer, director, deputy_director, phmu_lead, iv_admin. Then
facilitator, `tl_a`/`tl_b` (Team Lead), `ytl_a`/`ytl_b` (Youth Team Lead, who
today has full Team Lead power; left that way deliberately), `team_a`/`team_b`
(volunteer). AV: av_admin, av_atl, av_coord, av_team. Facilitators never see AV.
Team page flags: `IS_VIEW`, `IS_EDIT`, `CAN_MOVE`. The Hub helpers are in
`index.html` (`VIEW_A`, `ADMIN_A`, `USERS_ADMIN`, ...). UI gates are
presentation only; the database decides.

## How the roster works (teama.html)
- Cycles are lunar. `ANCHOR_K=327` (15 Jun 2026) is Team B; `teamForCycle(k)` alternates by parity. `cyStart(k)` is the new moon plus leader overrides; `cycleForDate` estimates then scans.
- `generateEventData(ev)` builds one event. `pick()` orders by: not done this duty this cycle, fewest this cycle, fewest across the previous three cycles, preference, random. `Math.random` breaks ties, so two builds differ.
- **Preview must equal what is saved.** `buildPlan(k,onlyEventId,opts)` generates against a staged copy of `ROSTERS` (restored in `finally`) and returns the staged rosters; `applyPlan(plan)` stores those, never regenerates. It is the only code that writes rosters.
- Duties set by hand set `manual[dutyKey]`; rebuilds carry them across. A hand edit calls `invalidatePlan()`.
- `slotCountsFor(ev,data)` counts filled/missing; `gapsFor` names the shortfalls.
- Cover: `iv_events.cover_uid`; `loadCovering`, `renderCoverPanels`.

## Database traps
- **RLS-refused UPDATE/DELETE is silent**: `{data:[],error:null}`. `dbWrite` asks for rows back and treats zero as failure. INSERT raises 42501.
- **Never `.select()` on an insert to `audit_logs`**: RETURNING hides the raise and rolls back.
- `majalis` multiplexes majalis/training/event via `data.category`.
- Saves are read back and compared (`saveRoster`). Keep that.
- The SQL setup scripts and `BUILD-PLAN.md` from earlier work are not in the repo. Every statement against the live database is run by the owner; the sandbox cannot reach Supabase or Cloudflare. Do not claim a save path works from here.

## Accessibility and UI rules in force
- Touch is keyed to `@media(hover:none)`, **not width**. Targets at least 44px there. Nothing may be hover-only.
- Chips are `<button>`s and must set `color` (a button does not inherit it).
- Text at least 11px, contrast AA, inputs 16px (iOS zooms below that).
- Narrow roster is the same table reflowed with `data-col` (no second renderer).
- `body{font-stretch:85%}` is on; **html2canvas ignores font-stretch**, so exports set `font-stretch:normal` (see av.html export).
- Motion respects `prefers-reduced-motion`; stagger only on the render after a page change (`.page.enter`).
- Splash has a 9s escape; never leave a way to be trapped behind an overlay.

## Testing
`tests/verify.cjs` starts its own server and drives teama.html at 390/820/1440 (the narrow two with touch), seeds `MEMBERS/EVENTS/ROSTERS`, and calls the page's own functions. It also checks teamb matches teama. Traps:
- Chips animate in from scale(.96); wait ~900ms before measuring sizes or a 44px target reads 42.
- Offline, the sign-in overlay re-inserts itself; inject `.noaccess{display:none!important}`.
- Above 1101px the sidebar is `display:none` and a generated top bar is the nav; use the top-bar items for keyboard tests.
- `#saveWarn` shares `.ib-warn` with the roster banner; scope selectors to `#page-roster`.
- Seeded volunteers need `status:'active'`.

## Workflow
1. Read before editing; match the surrounding comment density and style.
2. Python string-replace scripts that abort on a wrong match count have been safer than blind sed for edits to these large files.
3. After editing teama.html, regenerate teamb.html, run the suite, check zero page errors.
4. Commit with the repo's style: explain why, not just what.
5. Push to a `claude/...` branch; the owner merges. Offer the PR, do not assume it.

## Known gaps
- No save indicator above 1101px (the sync dot lives in the hidden sidebar).
- CI workflow was written without being able to run Actions; confirm it is green.
- Cover for plain volunteers; Youth Team Lead permissions; Hub Duty Stats vs team Numbers overlap.
