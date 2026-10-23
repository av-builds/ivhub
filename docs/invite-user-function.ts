// ═══════════════════════════════════════════════════════════════════
//  IV HUB - invite-user
//
//  Invites people, and deletes their account entirely when they leave.
//  Lives on Supabase's servers so the service-role key - which can do
//  anything to your database - never reaches a browser.
//
//  Both actions are limited to ranks 0-5 (Owner, Developer, Director,
//  Deputy Director, PHMU Lead, Facilitator) and you may only act on someone
//  strictly below you in the chain of command.
//
//  TO DEPLOY (no command line needed):
//    Supabase → Edge Functions → Create function
//    Name it exactly:  invite-user
//    Paste this whole file in, then click Deploy.
//
//  Supabase injects SUPABASE_URL / SUPABASE_ANON_KEY /
//  SUPABASE_SERVICE_ROLE_KEY automatically. Nothing to configure.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The site calls this from a browser on a different domain, so the
// browser sends a preflight check first. These headers answer it.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// The chain of command, mirrored from the site and the database.
const RANK: Record<string, number> = {
  owner: 0,
  developer: 1,
  director: 2, iv_admin: 2, deputy_director: 3, phmu_lead: 4,
  facilitator: 5,
  tl_a: 6, tl_b: 6, av_admin: 6,
  ytl_a: 7, ytl_b: 7, av_atl: 7,
  av_yatl: 8,
  av_coord: 9,
  team_a: 10, team_b: 10, av_team: 10,
};
// hasOwnProperty, not `in`. `"constructor" in RANK` is true - every object
// inherits it - so `in` would wave through prototype names as if they were
// permissions and write them onto the account.
const isPerm = (p: string) => Object.prototype.hasOwnProperty.call(RANK, p);

// ── What each role means, in plain English ───────────────────────────
// Shown to the person in their invite and reset emails (the templates read
// these from the account's user metadata as {{ .Data.role_label }},
// {{ .Data.role_rank }} and {{ .Data.role_explain }}). Written from the chain
// of command above: a lower rank number is higher authority, and you can only
// manage people ranked strictly below you.
const ROLE_INFO: Record<string, { label: string; blurb: string }> = {
  owner: { label: "Owner", blurb: "You have full control of IV Hub. You sit at the very top of the chain of command, you can manage every account and every setting, and nobody outranks you." },
  developer: { label: "Developer", blurb: "You look after the technical side of IV Hub. You sit just below the Owner and can manage accounts and settings for everyone beneath you." },
  director: { label: "Director", blurb: "You are part of IV leadership. You can manage accounts and rosters across both IV teams and the AV Team, and invite or remove anyone ranked below you." },
  iv_admin: { label: "Director", blurb: "You are part of IV leadership. You can manage accounts and rosters across both IV teams and the AV Team, and invite or remove anyone ranked below you." },
  deputy_director: { label: "Deputy Director", blurb: "You are part of IV leadership, with the same working access as a Director. You can manage accounts and rosters across both IV teams and the AV Team, and invite or remove anyone ranked below you." },
  phmu_lead: { label: "PHMU Lead", blurb: "You are part of IV leadership, with the same working access as a Director. You can manage accounts and rosters across both IV teams and the AV Team, and invite or remove anyone ranked below you." },
  facilitator: { label: "Facilitator", blurb: "You oversee Team A and Team B. You can build and publish rosters for both teams, manage their members, and invite Team Leads and volunteers. You report to IV leadership." },
  tl_a: { label: "Team A Lead", blurb: "You lead Team A. You can build and publish the Team A roster, mark attendance, and manage your team's members. You report to the Facilitators." },
  tl_b: { label: "Team B Lead", blurb: "You lead Team B. You can build and publish the Team B roster, mark attendance, and manage your team's members. You report to the Facilitators." },
  ytl_a: { label: "Team A Assistant Lead", blurb: "You support the Team A Lead. You have the same working access to the Team A roster and members, one step lower in the chain of command." },
  ytl_b: { label: "Team B Assistant Lead", blurb: "You support the Team B Lead. You have the same working access to the Team B roster and members, one step lower in the chain of command." },
  av_admin: { label: "AV Team Lead", blurb: "You lead the Audio-Visual team. You can build the AV roster and manage AV volunteers and their roles. You report to IV leadership." },
  av_atl: { label: "AV Team Assistant Lead", blurb: "You support the AV Team Lead. You have the same working access to the AV roster and volunteers, one step lower in the chain of command." },
  av_yatl: { label: "AV Youth Assistant Lead", blurb: "You support the AV leads with the AV youth. You have the same access as the AV Assistant Lead, one step lower in the chain of command." },
  av_coord: { label: "AV Team Co-ordinator", blurb: "You co-ordinate day-to-day AV duties alongside the AV leads. You sit between the AV youth leads and AV volunteers in the chain of command." },
  team_a: { label: "IV Team A Volunteer", blurb: "You are a Team A volunteer. You can see your own duties, your away dates and the Team A calendar. Your Team Lead builds the roster and will place you on it." },
  team_b: { label: "IV Team B Volunteer", blurb: "You are a Team B volunteer. You can see your own duties, your away dates and the Team B calendar. Your Team Lead builds the roster and will place you on it." },
  av_team: { label: "AV Team Volunteer", blurb: "You are an AV volunteer. You can see your own duties, your away dates and the AV calendar. The AV leads build the roster and will place you on it." },
};
const RANK_NAME = (r: number) =>
  r === 0 ? "Rank 0, the top of the chain of command" : r <= 5 ? `Rank ${r}, IV leadership` :
  r <= 9 ? `Rank ${r}, team leadership` : "Rank 10, volunteer";
// Keep an existing account's metadata in step with its current role, so a
// reset email describes the role they hold now, not the one they were invited with.
// Best effort: an email still goes out without it.
const syncRoleMeta = async (
  client: any, id: string, perms: string[],
) => {
  try {
    const { data } = await client.auth.admin.getUserById(id);
    const current = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
    await client.auth.admin.updateUserById(id, { user_metadata: { ...current, ...roleMeta(perms) } });
  } catch { /* the email is more important than its extras */ }
};
// The role facts an email needs, from a list of permissions. The highest
// authority (lowest rank number) leads; any others are listed beside it.
const roleMeta = (perms: string[]) => {
  const known = perms.filter(isPerm).sort((a, b) => RANK[a] - RANK[b]);
  if (!known.length) {
    return {
      role_label: "No role yet",
      role_rank: "Not ranked yet",
      role_explain: "Your account is ready but has no role yet. A Facilitator or leader will give you access, and your role and what it allows will appear here once they do.",
      role_extra: "",
    };
  }
  const top = known[0];
  const labels = [...new Set(known.map((p) => ROLE_INFO[p]?.label ?? p))];
  return {
    role_label: labels[0],
    role_rank: RANK_NAME(RANK[top]),
    role_explain: ROLE_INFO[top]?.blurb ?? "",
    role_extra: labels.length > 1 ? "Also: " + labels.slice(1).join(", ") : "",
  };
};
const rankOf = (perms: string[]) =>
  perms.length ? Math.min(...perms.map((p) => (isPerm(p) ? RANK[p] : 99))) : 99;
// Ranks 0-5 may manage accounts at all.
const MANAGE_RANK = 5;

// ── Where a link may point ────────────────────────────────────────────
// The invite and reset links carry a one-time access token in the URL. If
// the link can be aimed anywhere, whoever controls that address collects a
// working session for the person who clicks it. So the destination is
// checked against the sites this project actually runs on, and anything
// else falls back to undefined - which makes Supabase use the Site URL
// configured on the project, the correct destination anyway.
//
// Set SITE_URL under Edge Functions → Manage secrets if the Hub ever moves.
const allowedOrigins = (): string[] => {
  const out = new Set<string>(["https://av-builds.github.io"]);
  const extra = Deno.env.get("SITE_URL") ?? "";
  for (const raw of extra.split(/[\s,]+/)) {
    if (!raw) continue;
    try { out.add(new URL(raw).origin); } catch { /* ignore a malformed entry */ }
  }
  return [...out];
};
const safeRedirect = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  let u: URL;
  try { u = new URL(v); } catch { return undefined; }
  // http is only ever legitimate for a developer on their own machine.
  const localhost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && localhost)) return undefined;
  if (localhost) return v;
  return allowedOrigins().includes(u.origin) ? v : undefined;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Function is missing its Supabase keys. Redeploy it." }, 500);
  }

  // The service-role client, used by the no-sign-in path below. The
  // authenticated actions further down build their own after the caller
  // has been identified.
  const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 0. THE ONE ACTION THAT NEEDS NO SIGN-IN ─────────────────────
  // A volunteer who has forgotten their password cannot be signed in to
  // ask for a new one, so this runs before the authentication below.
  //
  // It is deliberately incapable of telling anyone anything. Whatever is
  // typed, the answer is the same sentence. A volunteer gets the email; a
  // Facilitator, Director or Owner does not and is told nothing different,
  // so this cannot be used to work out who holds authority - or even
  // whether an address has an account at all.
  if (req.method === "POST") {
    let peek: { action?: string; email?: string; redirectTo?: string } = {};
    try { peek = await req.clone().json(); } catch { /* handled below */ }
    if (String(peek.action ?? "") === "request-reset") {
      const said = { ok: true, message: "If that address has an account, a link is on its way." };
      const addr = String(peek.email ?? "").trim().toLowerCase();
      if (!addr || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(addr)) return json(said);

      const { data: who } = await svc
        .from("profiles").select("perms").eq("email", addr).maybeSingle();
      let p = who?.perms ?? [];
      if (typeof p === "string") { try { p = JSON.parse(p); } catch { p = []; } }
      if (!Array.isArray(p)) p = [];

      // Volunteers only. Anyone who can change a roster, manage an account
      // or read the audit log still gets their reset sent by a person.
      // Volunteers sit at rank 10; the Co-ordinator (9) is not one of them.
      if (who && rankOf(p as string[]) >= 10) {
        try {
          const { data: acct } = await svc.from("profiles").select("id").eq("email", addr).maybeSingle();
          if (acct?.id) await syncRoleMeta(svc, acct.id, p as string[]);
          await svc.auth.resetPasswordForEmail(addr, { redirectTo: safeRedirect(peek.redirectTo) });
          await svc.from("audit_logs").insert({
            ts: new Date().toISOString(),
            username: addr, user_display: addr,
            action: "Requested own password reset", category: "login",
            detail: "Self-service reset, volunteer",
          });
        } catch { /* never let a failure here change the answer */ }
      }
      return json(said);
    }
  }

  // ── 1. Who is calling? ──────────────────────────────────────────
  // The browser sends the caller's login token. We ask Supabase who it
  // belongs to; a forged or expired token simply fails here.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "You are not signed in." }, 401);
  }
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "Your sign-in has expired. Sign in again." }, 401);
  }
  const caller = userData.user;

  // ── 2. Are they allowed to invite? ──────────────────────────────
  // Read their permissions with the service key so this check cannot be
  // dodged by row-level rules, then compare against the list above.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: prof, error: profErr } = await admin
    .from("profiles").select("perms, display, email").eq("id", caller.id).maybeSingle();
  if (profErr) return json({ error: "Could not read your profile: " + profErr.message }, 500);

  let perms = prof?.perms ?? [];
  if (typeof perms === "string") { try { perms = JSON.parse(perms); } catch { perms = []; } }
  if (!Array.isArray(perms)) perms = [];
  const callerRank = rankOf(perms as string[]);
  if (callerRank > MANAGE_RANK) {
    return json({ error: "Only an Owner, Developer, Director, Deputy, PHMU Lead or Facilitator can manage accounts." }, 403);
  }

  // ── 3. Validate what they sent ──────────────────────────────────
  let body: {
    action?: string; email?: string; redirectTo?: string;
    display?: string; id?: string; perms?: unknown; member_id?: unknown;
  };
  try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const action = String(body.action ?? "invite");

  // ── DELETE: remove someone from the Hub entirely ─────────────────
  if (action === "delete") {
    const targetId = String(body.id ?? "");
    if (!targetId) return json({ error: "No account specified." }, 400);
    if (targetId === caller.id) return json({ error: "You cannot delete your own account." }, 400);

    const { data: target, error: tErr } = await admin
      .from("profiles").select("perms, email, display").eq("id", targetId).maybeSingle();
    if (tErr) return json({ error: "Could not read that account: " + tErr.message }, 500);
    if (!target) return json({ error: "That account no longer exists." }, 404);

    let tPerms = target.perms ?? [];
    if (typeof tPerms === "string") { try { tPerms = JSON.parse(tPerms); } catch { tPerms = []; } }
    if (!Array.isArray(tPerms)) tPerms = [];
    // Strictly below you, or the request is refused.
    if (callerRank >= rankOf(tPerms as string[])) {
      return json({ error: "That account is at or above your level in the chain of command." }, 403);
    }

    // Removing the auth user cascades to their profile row.
    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return json({ error: "Could not remove the account: " + delErr.message }, 500);

    try {
      await admin.from("audit_logs").insert({
        ts: new Date().toISOString(),
        username: prof?.email ?? caller.email ?? "",
        user_display: prof?.display ?? caller.email ?? "",
        action: "Removed account",
        category: "login",
        detail: (target.email ?? targetId) + ": permanently deleted",
      });
    } catch { /* logging is optional */ }

    return json({ ok: true, deleted: target.email ?? targetId });
  }

  // ── RESET: send a password reset, and end their sessions ─────────
  if (action === "reset") {
    const targetId = String(body.id ?? "");
    const targetEmail = String(body.email ?? "").trim().toLowerCase();
    if (!targetId && !targetEmail) return json({ error: "No account specified." }, 400);

    const { data: target, error: tErr } = await admin
      .from("profiles").select("id, perms, email, display")
      .eq(targetId ? "id" : "email", targetId || targetEmail).maybeSingle();
    if (tErr) return json({ error: "Could not read that account: " + tErr.message }, 500);
    if (!target) return json({ error: "That account no longer exists." }, 404);

    let tPerms = target.perms ?? [];
    if (typeof tPerms === "string") { try { tPerms = JSON.parse(tPerms); } catch { tPerms = []; } }
    if (!Array.isArray(tPerms)) tPerms = [];
    // Same chain-of-command rule as inviting and removing.
    if (callerRank >= rankOf(tPerms as string[])) {
      return json({ error: "That account is at or above your level in the chain of command." }, 403);
    }

    const email = String(target.email ?? targetEmail);
    const redirectTo = safeRedirect(body.redirectTo);
    await syncRoleMeta(admin, target.id, tPerms as string[]);

    // End every session first. If this failed silently the email would
    // promise a sign-out that never happened, so the result is reported
    // rather than swallowed - a reset that leaves sessions alive is a
    // different, weaker thing than the one the email describes.
    let signedOut = false, signOutNote = "";
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${target.id}/logout`, {
        method: "POST",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      signedOut = r.ok;
      if (!r.ok) signOutNote = `sign-out returned ${r.status}`;
    } catch (e) { signOutNote = "sign-out request failed: " + (e as Error).message; }

    const { error: mailErr } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (mailErr) {
      const m = mailErr.message || String(mailErr);
      if (/rate limit|too many/i.test(m)) {
        return json({ error: "Email rate limit reached. Wait a few minutes and try again." }, 429);
      }
      return json({ error: "Could not send the reset: " + m }, 500);
    }

    try {
      await admin.from("audit_logs").insert({
        ts: new Date().toISOString(),
        username: prof?.email ?? caller.email ?? "",
        user_display: prof?.display ?? caller.email ?? "",
        action: "Sent password reset", category: "login",
        detail: email + (signedOut ? ": sessions ended" : ": sessions NOT ended (" + signOutNote + ")"),
      });
    } catch { /* logging is optional */ }

    return json({ ok: true, email, signedOut, warning: signedOut ? undefined :
      "Reset email sent, but their existing sessions could not be ended (" + signOutNote +
      "). They stay signed in on devices until the new password is set." });
  }

  if (action !== "invite") return json({ error: "Unknown action." }, 400);

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
    return json({ error: "That does not look like a valid email address." }, 400);
  }

  // Only allow the invite link to point back at this project's own site,
  // so a stolen token cannot redirect new users to somewhere hostile.
  const redirectTo = safeRedirect(body.redirectTo);

  // ── 3b. Permissions to grant on arrival ─────────────────────────
  // Whatever is ticked at invite time is what the account has the moment
  // they finish setting a password - no second step, nothing to forget.
  //
  // This is re-checked here rather than trusted from the browser. The
  // dropdown on the site is convenience; anyone can call this endpoint
  // directly, so the rule that you may only hand out authority strictly
  // below your own has to be enforced on this side.
  const wanted = Array.isArray(body.perms)
    ? [...new Set(body.perms.map((p) => String(p)))].filter(isPerm)
    : [];

  // Facilitators staff the two IV teams and nothing else. Mirrors
  // grantableRoles() on the site; keep the two in step.
  const isIvTop = (perms as string[]).some((p) =>
    ["owner", "developer", "director", "deputy_director", "phmu_lead", "iv_admin"].includes(p)
  );
  const facilitatorOnly = (perms as string[]).includes("facilitator") && !isIvTop;
  const FACILITATOR_MAY = ["tl_a", "ytl_a", "tl_b", "ytl_b", "team_a", "team_b"];

  const refused = wanted.filter((p) =>
    facilitatorOnly ? !FACILITATOR_MAY.includes(p) : RANK[p] <= callerRank
  );
  if (refused.length) {
    return json({
      error: "You cannot grant " + refused.join(", ") +
             " because it is at or above your own level in the chain of command.",
    }, 403);
  }

  // Written with the service key into a table the browser cannot reach, so
  // the grant cannot be forged by anyone signing themselves up. The database
  // trigger picks it up when the account row appears.
  if (wanted.length || body.display) {
    const { error: pErr } = await admin.from("invited_perms").upsert({
      email,
      perms: wanted,
      display: body.display ? String(body.display).slice(0, 120) : null,
      invited_by: caller.id,
    }, { onConflict: "email" });
    // A missing table means SETUP-AUTH.sql has not been re-run. Not fatal -
    // the direct write after the invite below covers it.
    if (pErr && !/does not exist|schema cache/i.test(pErr.message)) {
      return json({ error: "Could not stage the permissions: " + pErr.message }, 500);
    }
  }

  // ── 4. Send it ──────────────────────────────────────────────────
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      ...(body.display ? { display: String(body.display).slice(0, 120) } : {}),
      ...roleMeta(wanted),
      invited_by: String(prof?.display ?? caller.email ?? "IV Hub").slice(0, 120),
    },
  });

  if (inviteErr) {
    // Don't leave a staged grant behind for an invite that never went out.
    try { await admin.from("invited_perms").delete().eq("email", email); } catch { /* best effort */ }
    const m = inviteErr.message || String(inviteErr);
    // The two failures you are most likely to hit, in plain English.
    if (/already been registered|already exists/i.test(m)) {
      return json({ error: "That email already has an account. It will be in the list below." }, 409);
    }
    if (/rate limit|too many/i.test(m)) {
      return json({
        error: "Supabase's email limit was hit. Add your own SMTP under " +
               "Project Settings → Authentication → SMTP to send in bulk.",
      }, 429);
    }
    return json({ error: "Invite failed: " + m }, 500);
  }

  // Supabase creates the account row the moment the invite is sent, not when
  // it is accepted, so the profile already exists here. Write the permissions
  // onto it directly. The staged row above is the belt; this is the braces -
  // it means the grant lands even if SETUP-AUTH.sql has not been re-run yet.
  const newId = invited?.user?.id ?? null;
  let granted = wanted;

  // The member this account belongs to, joined at the moment the account
  // is created rather than matched by name afterwards. This is the whole
  // reason invitations are sent from the member directory: three hundred
  // accounts that each already know which person they are, so My Duties
  // works the first time everybody signs in.
  const memberId = Number(body.member_id);
  const linkMember = Number.isInteger(memberId) && memberId > 0 ? memberId : null;

  if (newId && (wanted.length || linkMember !== null)) {
    const patch: Record<string, unknown> = {};
    if (wanted.length) patch.perms = wanted;
    if (linkMember !== null) patch.member_id = linkMember;
    const { error: upErr } = await admin.from("profiles").update(patch).eq("id", newId);
    if (upErr) {
      granted = [];
      // The invite is already gone; say so plainly rather than pretending.
      return json({
        ok: true, email, id: newId, perms: [], member_id: null,
        warning: "Invite sent, but the permissions did not save (" + upErr.message +
                 "). Grant them from the list below.",
      });
    }
    try { await admin.from("invited_perms").delete().eq("email", email); } catch { /* best effort */ }
  }

  // Record who did it. Best-effort - never fail the invite over logging.
  try {
    await admin.from("audit_logs").insert({
      ts: new Date().toISOString(),
      username: prof?.email ?? caller.email ?? "",
      user_display: prof?.display ?? caller.email ?? "",
      action: "Invited user",
      category: "login",
      detail: email + (granted.length ? ": granted " + granted.join(", ") : ": no access")
              + (linkMember !== null ? " · linked to member #" + linkMember : ""),
    });
  } catch { /* logging is optional */ }

  return json({ ok: true, email, id: newId, perms: granted, member_id: linkMember });
});
