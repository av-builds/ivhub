# Divisions, teams and roles — backend checklist

The site side is done (pages, Hub menu, roles in Login Management). **Granting
these roles will fail until the backend accepts the new role keys.** Nothing
below can be applied from the website; it is Supabase work (SQL editor / Edge
Function deploy). No credentials belong in this file.

## Structure (from the IV chart)

| Division (page) | Teams (pages) |
|---|---|
| Ancillary Services `ancillary.html` | Maintenance `maintenance.html`, Cooking Team `cooking.html`, Cleaning Volunteers `cleaning.html` |
| Paat `paat.html` | Abeshafa Paat Group `abeshafa.html`, Sukreet Paat Group `sukreet.html` |
| Safety & Security `safety.html` | none yet (its four support areas are not built) |
| Training & Development `training.html` | none |

Flute/Pipe Band is not on the site. All pages are "Under construction".

## The 23 role keys

Division roles (Lead rank 6, Assistant Lead rank 7):

| Division | Lead | Assistant Lead |
|---|---|---|
| Ancillary Services | `an_lead` | `an_alead` |
| Paat | `pt_lead` | `pt_alead` |
| Safety & Security | `ss_lead` | `ss_alead` |
| Training & Development | `td_lead` | `td_alead` |

Team roles (Lead 6, Assistant Lead 7, Volunteer 9):

| Team | Lead | Assistant Lead | Volunteer |
|---|---|---|---|
| Maintenance | `mt_lead` | `mt_alead` | `mt_team` |
| Cooking Team | `ck_lead` | `ck_alead` | `ck_team` |
| Cleaning Volunteers | `cl_lead` | `cl_alead` | `cl_team` |
| Abeshafa Paat Group | `ab_lead` | `ab_alead` | `ab_team` |
| Sukreet Paat Group | `sk_lead` | `sk_alead` | `sk_team` |

Labels: "Ancillary Services Lead", "Paat Team Lead", "Paat Assistant Team Lead",
"Safety & Security Lead", "Assistant Safety & Security Lead",
"Training & Development Lead"; team roles read "Cooking Team Lead",
"Cooking Team Assistant Lead", "Cooking Team Volunteer", and so on.

## Access rules (enforced in the site; the database decides what can change)

- A team's own roles open that team's page.
- A division Lead or Assistant Lead opens their division page **and every team
  page under it**. They get no other Hub powers (no Login Management, no
  user management, no other divisions).
- Owner, Developer, Director, Deputy Director and PHMU Lead open everything.
- Granting these roles: Director, Deputy Director, PHMU Lead and above only.
  Facilitators still manage Teams A and B only.

## What to change

1. **`invite-user` Edge Function** — add the 23 keys wherever it lists valid
   roles/permissions and wherever it maps a role to a rank (ranks above).
   Keep the rule that an actor may only grant roles ranking strictly below
   their own.
2. **`profiles.perms`** — if there is a CHECK constraint, enum or trigger
   restricting the allowed values, add the 23 keys.
3. **Any SQL function that lists roles** (rank helpers used by row-level
   security) — add the 23 keys at the ranks above. `my_prepare_teams()`,
   `my_approve_teams()` and `member_invite_team()` need no change: these teams
   have no invitation or approval flow yet.
4. **Row-level security** — nothing is required for the placeholder pages; they
   read only the viewer's own `profiles` row. When a team's roster is built,
   its tables and policies are designed then, and a division head's reach
   beneath them should be written into those policies too.

## Checking it worked

1. As a Director, grant a test account **Cooking Team Volunteer**. Signing in
   shows **Specialized Teams → Ancillary Services › Cooking Team** in the menu
   and the Under Construction page.
2. Grant another **Ancillary Services Lead**. They land on the Ancillary
   Services page, which lists Maintenance, Cooking and Cleaning; they can open
   each, and cannot open Paat.

## Changing names or adding a team

Edit `DIVISIONS` in `index.html` and in `tools/make-specialty.cjs` (they mirror
each other), then run `node tools/make-specialty.cjs` to regenerate the pages.
New role keys must also be added in the backend as above.

## Team assignment (User Management) — one more backend check

User Management now lets you assign a person to the new teams as well as AV,
grouped under the four menu categories. These are stored in `iv_members.spec`
as these values: `AV`, `ABESHAFA`, `SUKREET`, `TD`, `SAFETY`, `MAINTENANCE`,
`COOKING`, `CLEANING`. If `iv_members.spec` has a CHECK constraint or trigger
that only allows certain values, add these. (If it is unconstrained nothing is
needed.) Assigning a team does not grant access; roles are still granted in
Login Management, which now offers a **team**, then a **level**.

## Menu categories

PHMU (Team A, Team B, AV Team, Paat Team and its two groups), Training &
Development and Safety & Security (standalone), Ancillary Services
(Maintenance, Cooking, Cleaning).
