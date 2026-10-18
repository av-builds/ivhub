# New specialized-team roles — backend checklist

The site side is done (pages, Hub menu, roles in Login Management). **Granting
these roles will fail until the backend accepts the new role keys.** Nothing
below can be applied from the website; it is Supabase work (SQL editor / Edge
Function deploy). No credentials belong in this file.

## The 18 role keys

| Team | Lead (rank 6) | Assistant Lead (rank 7) | Volunteer (rank 9) |
|---|---|---|---|
| Cleaning Volunteers | `cl_lead` | `cl_alead` | `cl_team` |
| Safety Team | `sf_lead` | `sf_alead` | `sf_team` |
| Cooking Team | `ck_lead` | `ck_alead` | `ck_team` |
| Abeshafa Paat Group | `ab_lead` | `ab_alead` | `ab_team` |
| Sukreet Paat Group | `sk_lead` | `sk_alead` | `sk_team` |
| Ancillary Services | `an_lead` | `an_alead` | `an_team` |

Display labels: "Cleaning Team Lead", "Cleaning Team Assistant Lead",
"Cleaning Team Volunteer", and likewise for the others (`Safety Team …`,
`Cooking Team …`, `Abeshafa Paat …`, `Sukreet Paat …`, `Ancillary Services …`).

Rank follows AV: lead 6, assistant 7, volunteer 9 (lower outranks higher).
Granting rule is unchanged: only Director, Deputy Director, PHMU Lead and above
(strictly outranking the role granted). Facilitators still manage Team A/B only.

## What to change

1. **`invite-user` Edge Function** — add the 18 keys wherever it lists valid
   roles/permissions and wherever it maps a role to a rank. Keep the existing
   rule that an actor may only grant roles ranking strictly below their own.
2. **`profiles.perms`** — if there is a CHECK constraint, enum or trigger that
   restricts the allowed values, add the 18 keys.
3. **Any SQL function that lists roles** (for example rank helpers used by
   row-level security) — add the 18 keys at the ranks above. The existing
   `my_prepare_teams()`, `my_approve_teams()` and `member_invite_team()` do
   **not** need changing: these teams have no invitation or approval flow yet.
4. **Row-level security** — nothing is required for the placeholder pages; they
   read only the viewer's own `profiles` row. When a team's roster is built,
   its tables and policies are designed then.

## Checking it worked

1. As a Director, open Login Management → Invite a user (or edit someone) and
   confirm the new roles appear in the dropdown. Grant one, e.g. Safety Team
   Volunteer, to a test account.
2. Sign in as that account: the menu shows **Specialized Teams → Safety Team**
   and the page shows the Under Construction sign.
3. Grant a Lead role and sign in again: the account lands on its team page and
   the Hub has an "Open team page" tile.

## Changing a team's name or adding a team

Edit `SPECIALTY` in `index.html` and `TEAMS` in `tools/make-specialty.cjs` (they
mirror each other), then run `node tools/make-specialty.cjs` to regenerate the
page files. A new team also needs its role keys added in the backend as above.
