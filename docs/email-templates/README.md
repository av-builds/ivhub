# IV Hub emails

Supabase sends these emails, so the designs live in the Supabase dashboard, not in the function.
Paste each file in once:

1. Supabase dashboard, **Authentication**, **Emails** (Email Templates).
2. **Invite user**: Subject `Your IV Hub invitation`, then paste `invite.html` as the message body.
3. **Reset password**: Subject `Reset your IV Hub password`, then paste `reset.html` as the message body.
4. Save each one.

## What fills in the role explanation

The `invite-user` Edge Function (`docs/invite-user-function.ts`) puts the person's role facts on their account
when it sends an invite, and refreshes them before it sends a reset. The templates read them as:

| Template variable | Example |
|---|---|
| `{{ .Data.display }}` | Aly Kotadia |
| `{{ .Data.invited_by }}` | Ahad Lokhandwala |
| `{{ .Data.role_label }}` | Team A Lead |
| `{{ .Data.role_rank }}` | Rank 6, team leadership |
| `{{ .Data.role_explain }}` | a plain-English sentence on what the role allows |
| `{{ .Data.role_extra }}` | `Also: Team B Lead` when they hold more than one role |

The wording for each role is the `ROLE_INFO` table at the top of the function. Edit it there and redeploy to change what people are told.
If someone is invited with no role, the email says so and explains that a leader will give them access.
