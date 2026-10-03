"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, canEdit, endSession, hashPassword, requireOrg, requireSite, requireUser, startSession, tokenHash, verifyPassword } from "@/lib/auth.ts";
import { esc, layout, sendEmail } from "@/lib/email.ts";
import { allow, blocked, recordFailure } from "@/lib/rate-limit.ts";
import { headers } from "next/headers";
import { ch, sql } from "@/lib/db.ts";
import { deleteVisitor } from "@/lib/visitors.ts";
import { encrypt } from "@/lib/crypto.ts";
import { deleteImport } from "@/lib/import-job.ts";
import { billingConfigured, createCheckout, createPortal, limits } from "@/lib/billing.ts";
import { PAID, priceIdFor, type PlanId } from "@/lib/plans.ts";

export type FormState = { error?: string } | undefined;

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(`signup:${ip}`, 10, 60 * 60_000)) return { error: "Too many signups from this network. Try again later." };
  const parsed = credentials.extend({ name: z.string().trim().max(100) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { email, password, name } = parsed.data;
  const next = safeNext(form.get("next"));
  const hash = await hashPassword(password);
  const userId = await sql.begin(async (tx) => {
    const [u] = await tx<{ id: string }[]>`INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name}, ${hash}) ON CONFLICT (email) DO NOTHING RETURNING id`;
    if (!u) return null;
    if (next.startsWith("/invite/")) return u.id; // joining someone else's team
    const [o] = await tx<{ id: string }[]>`INSERT INTO organizations (name) VALUES (${name ? `${name}'s team` : "My team"}) RETURNING id`;
    await tx`INSERT INTO memberships (org_id, user_id, role) VALUES (${o!.id}, ${u.id}, 'owner')`;
    return u.id;
  });
  if (!userId) return { error: "An account with this email already exists" };
  await startSession(userId);
  redirect(next.startsWith("/invite/") ? next : "/sites/new");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Invalid email or password" };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const keys = [`login:${ip}`, `login:${parsed.data.email}`];
  if (blocked(keys[0]!, 20) || blocked(keys[1]!, 8)) return { error: "Too many failed attempts. Wait 15 minutes or reset your password." };
  const [u] = await sql<{ id: string; password_hash: string }[]>`SELECT id, password_hash FROM users WHERE email = ${parsed.data.email}`;
  if (!u || !(await verifyPassword(parsed.data.password, u.password_hash))) {
    for (const k of keys) recordFailure(k, 15 * 60_000);
    return { error: "Invalid email or password" };
  }
  await startSession(u.id);
  redirect(safeNext(form.get("next")) || "/sites");
}

/** Only same-site relative paths, so ?next= can't be used as an open redirect. */
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return /^\/(?!\/)[\w\-/?=&.%]*$/.test(s) ? s : "";
}

export async function logout() {
  await endSession();
  redirect("/login");
}

const siteSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
    .pipe(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$|^localhost$/, "Enter a domain like example.com")),
  timezone: z.string().refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz) || tz === "UTC", "Unknown timezone"),
  mode: z.enum(["private", "product"]),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
});

export async function createSite(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = siteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const [m] = await sql<{ org_id: string }[]>`SELECT org_id FROM memberships WHERE user_id = ${user.id} AND role IN ('owner', 'admin') LIMIT 1`;
  if (!m) return { error: "You need an owner or admin role to add sites" };
  const lim = await limits(m.org_id);
  if (lim.sites >= lim.plan.websites) return { error: `Your ${lim.plan.name} plan includes ${lim.plan.websites} websites. Upgrade in Team & billing to add more.` };
  const { name, domain, timezone, mode, currency } = parsed.data;
  const [site] = await sql<{ id: string }[]>`
    INSERT INTO sites (org_id, public_id, name, domain, timezone, mode, currency)
    VALUES (${m.org_id}, ${randomBytes(6).toString("base64url")}, ${name}, ${domain}, ${timezone}, ${mode}, ${currency}) RETURNING id`;
  await audit(m.org_id, user.id, "site.created", domain);
  redirect(`/sites/${site!.id}/settings?welcome=1`);
}

export async function updateSite(siteId: string, _: FormState, form: FormData): Promise<FormState> {
  const { role } = await requireSite(siteId);
  if (!canEdit(role)) return { error: "Only owners and admins can change settings" };
  const parsed = siteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { name, domain, timezone, mode, currency } = parsed.data;
  await sql`UPDATE sites SET name = ${name}, domain = ${domain}, timezone = ${timezone}, mode = ${mode}, currency = ${currency} WHERE id = ${siteId}`;
  revalidatePath(`/sites/${siteId}`, "layout");
  return {};
}

export async function toggleSharing(siteId: string) {
  const { site, role, user } = await requireSite(siteId);
  if (!canEdit(role)) return;
  const token = site.share_token ? null : randomBytes(18).toString("base64url");
  await sql`UPDATE sites SET share_token = ${token} WHERE id = ${siteId}`;
  await audit(site.org_id, user.id, token ? "site.shared" : "site.unshared", site.domain);
  revalidatePath(`/sites/${siteId}/settings`);
}

export async function deleteSite(siteId: string, form: FormData) {
  const { site, role, user } = await requireSite(siteId);
  if (!canEdit(role) || form.get("confirm") !== site.domain) return;
  await audit(site.org_id, user.id, "site.deleted", site.domain);
  await ch.command({ query: "ALTER TABLE events DELETE WHERE site_id = {site:UUID}", query_params: { site: siteId } });
  await sql`DELETE FROM sites WHERE id = ${siteId}`;
  redirect("/sites");
}

export async function deleteVisitorAction(siteId: string, visitorId: string) {
  const { role } = await requireSite(siteId);
  if (!canEdit(role)) return;
  await deleteVisitor(siteId, visitorId);
  redirect(`/sites/${siteId}/visitors`);
}

const goalSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  kind: z.enum(["pageview", "event"]),
  match: z.string().trim().min(1, "Enter a path or event name").max(256),
});

export async function createGoal(siteId: string, _: FormState, form: FormData): Promise<FormState> {
  const { role } = await requireSite(siteId);
  if (role === "viewer") return { error: "Viewers can't create goals" };
  const parsed = goalSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { name, kind, match } = parsed.data;
  if (kind === "pageview" && !match.startsWith("/")) return { error: "Page paths start with /" };
  await sql`INSERT INTO goals (site_id, name, kind, match) VALUES (${siteId}, ${name}, ${kind}, ${match})`;
  revalidatePath(`/sites/${siteId}`, "layout");
  return {};
}

export async function deleteGoal(siteId: string, goalId: string) {
  const { role } = await requireSite(siteId);
  if (role === "viewer") return;
  await sql`DELETE FROM goals WHERE id = ${goalId} AND site_id = ${siteId}`;
  revalidatePath(`/sites/${siteId}`, "layout");
}

const PAYMENT_PROVIDERS = ["stripe", "lemonsqueezy", "polar", "paddle"] as const;

export async function saveRevenueConnection(siteId: string, provider: string, _: FormState, form: FormData): Promise<FormState> {
  const { role, site, user } = await requireSite(siteId);
  if (!canEdit(role)) return { error: "Only owners and admins can connect payments" };
  if (!(PAYMENT_PROVIDERS as readonly string[]).includes(provider)) return { error: "Unknown provider" };
  const secret = String(form.get("secret") ?? "").trim();
  if (secret.length < 6 || secret.length > 500) return { error: "Paste the webhook signing secret" };
  if (provider === "stripe" && !secret.startsWith("whsec_")) return { error: "Stripe signing secrets start with whsec_" };
  await sql`INSERT INTO revenue_connections (site_id, provider, secret_enc) VALUES (${siteId}, ${provider}, ${encrypt(secret)})
            ON CONFLICT (site_id, provider) DO UPDATE SET secret_enc = EXCLUDED.secret_enc`;
  await audit(site.org_id, user.id, "revenue.connected", `${provider} · ${site.domain}`);
  revalidatePath(`/sites/${siteId}`, "layout");
  return {};
}

export async function removeRevenueConnection(siteId: string, provider: string) {
  const { role } = await requireSite(siteId);
  if (!canEdit(role)) return;
  await sql`DELETE FROM revenue_connections WHERE site_id = ${siteId} AND provider = ${provider}`;
  revalidatePath(`/sites/${siteId}`, "layout");
}

/** Creates (or rotates) the site's server API key. The key is only ever shown in this response. */
export async function createRevenueApiKey(siteId: string): Promise<{ key?: string; error?: string }> {
  const { role, site, user } = await requireSite(siteId);
  if (!canEdit(role)) return { error: "Only owners and admins can create API keys" };
  const key = `wp_sk_${randomBytes(24).toString("base64url")}`;
  await sql`INSERT INTO revenue_connections (site_id, provider, secret_enc) VALUES (${siteId}, 'api', ${encrypt(key)})
            ON CONFLICT (site_id, provider) DO UPDATE SET secret_enc = EXCLUDED.secret_enc, last_event_at = NULL`;
  await audit(site.org_id, user.id, "revenue.api_key_created", site.domain);
  revalidatePath(`/sites/${siteId}/settings`);
  return { key };
}

const funnelSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  window_hours: z.coerce.number().int().min(1).max(2160),
  steps: z
    .string()
    .transform((s, ctx) => { try { return JSON.parse(s); } catch { ctx.addIssue({ code: "custom", message: "Invalid steps" }); return z.NEVER; } })
    .pipe(z.array(z.object({
      kind: z.enum(["pageview", "event"]),
      match: z.string().trim().min(1, "Every step needs a page path or event name").max(256),
      label: z.string().trim().max(80).optional(),
    })).min(2, "A funnel needs at least two steps").max(10)),
});

export async function saveFunnel(siteId: string, funnelId: string | null, _: FormState, form: FormData): Promise<FormState> {
  const { role } = await requireSite(siteId);
  if (role === "viewer") return { error: "Viewers can't edit funnels" };
  const parsed = funnelSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { name, window_hours, steps } = parsed.data;
  const bad = steps.find((s) => s.kind === "pageview" && !s.match.startsWith("/"));
  if (bad) return { error: `Page paths start with / ("${bad.match}")` };
  let id = funnelId;
  if (id) await sql`UPDATE funnels SET name = ${name}, window_hours = ${window_hours}, steps = ${sql.json(steps)} WHERE id = ${id} AND site_id = ${siteId}`;
  else id = (await sql<{ id: string }[]>`INSERT INTO funnels (site_id, name, window_hours, steps) VALUES (${siteId}, ${name}, ${window_hours}, ${sql.json(steps)}) RETURNING id`)[0]!.id;
  revalidatePath(`/sites/${siteId}/funnels`, "layout");
  redirect(`/sites/${siteId}/funnels/${id}`);
}

export async function deleteFunnel(siteId: string, funnelId: string) {
  const { role } = await requireSite(siteId);
  if (role === "viewer") return;
  await sql`DELETE FROM funnels WHERE id = ${funnelId} AND site_id = ${siteId}`;
  redirect(`/sites/${siteId}/funnels`);
}

export async function setDigest(siteId: string, form: FormData) {
  const { user } = await requireSite(siteId);
  const frequency = String(form.get("frequency"));
  if (frequency === "off") await sql`DELETE FROM email_reports WHERE site_id = ${siteId} AND user_id = ${user.id}`;
  else if (frequency === "weekly" || frequency === "monthly")
    await sql`INSERT INTO email_reports (site_id, user_id, frequency) VALUES (${siteId}, ${user.id}, ${frequency})
              ON CONFLICT (site_id, user_id) DO UPDATE SET frequency = EXCLUDED.frequency`;
  revalidatePath(`/sites/${siteId}/settings`);
}

// ---------- team ----------

const isManager = (role: string) => role === "owner" || role === "admin";

export async function renameOrg(_: FormState, form: FormData): Promise<FormState> {
  const { org, role, user } = await requireOrg();
  if (!isManager(role)) return { error: "Only owners and admins can rename the team" };
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 100) return { error: "Enter a team name" };
  await sql`UPDATE organizations SET name = ${name} WHERE id = ${org.id}`;
  await audit(org.id, user.id, "team.renamed", name);
  revalidatePath("/", "layout");
  return {};
}

export async function inviteMember(_: FormState, form: FormData): Promise<FormState & { link?: string }> {
  const { org, role, user } = await requireOrg();
  if (!isManager(role)) return { error: "Only owners and admins can invite" };
  const parsed = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email"), role: z.enum(["admin", "member", "viewer"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { email } = parsed.data;
  const lim = await limits(org.id);
  if (lim.members >= lim.plan.members) return { error: `Your ${lim.plan.name} plan includes ${lim.plan.members} team members. Upgrade to invite more.` };
  const [already] = await sql`SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ${org.id} AND u.email = ${email}`;
  if (already) return { error: `${email} is already on the team` };
  const token = randomBytes(24).toString("base64url");
  await sql`DELETE FROM invitations WHERE org_id = ${org.id} AND email = ${email} AND accepted_at IS NULL`;
  await sql`INSERT INTO invitations (org_id, email, role, token_hash, invited_by) VALUES (${org.id}, ${email}, ${parsed.data.role}, ${tokenHash(token)}, ${user.id})`;
  const link = `${process.env.APP_URL ?? ""}/invite/${token}`;
  await sendEmail({
    to: email,
    subject: `${user.name || user.email} invited you to ${org.name} on Waypoint`,
    html: layout(`Join ${org.name} on Waypoint`, `<p>${esc(user.name || user.email)} invited you to view analytics as <b>${parsed.data.role}</b>. The invitation expires in 7 days.</p>`, { href: link, label: "Accept invitation" }),
    text: `${user.name || user.email} invited you to ${org.name} on Waypoint. Accept: ${link}`,
  });
  await audit(org.id, user.id, "member.invited", `${email} as ${parsed.data.role}`);
  revalidatePath("/settings/team");
  return { link };
}

export async function revokeInvite(inviteId: string) {
  const { org, role, user } = await requireOrg();
  if (!isManager(role)) return;
  const [inv] = await sql<{ email: string }[]>`DELETE FROM invitations WHERE id = ${inviteId} AND org_id = ${org.id} RETURNING email`;
  if (inv) await audit(org.id, user.id, "invite.revoked", inv.email);
  revalidatePath("/settings/team");
}

export async function changeRole(memberId: string, form: FormData) {
  const { org, role, user } = await requireOrg();
  const next = String(form.get("role"));
  if (!isManager(role) || !["admin", "member", "viewer"].includes(next) || memberId === user.id) return;
  const [m] = await sql<{ email: string }[]>`
    UPDATE memberships SET role = ${next} FROM users u WHERE memberships.org_id = ${org.id} AND memberships.user_id = ${memberId}
      AND memberships.role != 'owner' AND u.id = memberships.user_id RETURNING u.email`;
  if (m) await audit(org.id, user.id, "member.role_changed", `${m.email} → ${next}`);
  revalidatePath("/settings/team");
}

export async function removeMember(memberId: string) {
  const { org, role, user } = await requireOrg();
  if (!isManager(role) || memberId === user.id) return;
  const [m] = await sql<{ email: string }[]>`
    DELETE FROM memberships USING users u WHERE memberships.org_id = ${org.id} AND memberships.user_id = ${memberId}
      AND memberships.role != 'owner' AND u.id = memberships.user_id RETURNING u.email`;
  if (m) await audit(org.id, user.id, "member.removed", m.email);
  revalidatePath("/settings/team");
}

export async function acceptInvite(token: string) {
  const user = await requireUser();
  const [inv] = await sql<{ id: string; org_id: string; role: string; email: string }[]>`
    SELECT id, org_id, role, email FROM invitations WHERE token_hash = ${tokenHash(token)} AND accepted_at IS NULL AND expires_at > now()`;
  if (!inv) redirect("/sites");
  await sql.begin(async (tx) => {
    await tx`INSERT INTO memberships (org_id, user_id, role) VALUES (${inv.org_id}, ${user.id}, ${inv.role}) ON CONFLICT DO NOTHING`;
    await tx`UPDATE invitations SET accepted_at = now() WHERE id = ${inv.id}`;
  });
  await audit(inv.org_id, user.id, "member.joined", user.email);
  redirect("/sites");
}

// ---------- API keys (REST + MCP) ----------

export async function createApiKey(_: { key?: string; error?: string }, form: FormData): Promise<{ key?: string; error?: string }> {
  const { org, role, user } = await requireOrg();
  if (!isManager(role)) return { error: "Only owners and admins can create API keys" };
  const name = String(form.get("name") ?? "").trim().slice(0, 60) || "API key";
  const key = `wp_live_${randomBytes(24).toString("base64url")}`;
  await sql`INSERT INTO api_keys (org_id, name, prefix, key_hash, created_by) VALUES (${org.id}, ${name}, ${key.slice(0, 12)}, ${tokenHash(key)}, ${user.id})`;
  await audit(org.id, user.id, "api_key.created", name);
  revalidatePath("/settings/api");
  return { key };
}

export async function revokeApiKey(id: string) {
  const { org, role, user } = await requireOrg();
  if (!isManager(role)) return;
  const [k] = await sql<{ name: string }[]>`UPDATE api_keys SET revoked_at = now() WHERE id = ${id} AND org_id = ${org.id} AND revoked_at IS NULL RETURNING name`;
  if (k) await audit(org.id, user.id, "api_key.revoked", k.name);
  revalidatePath("/settings/api");
}

export async function deleteImportAction(siteId: string, importId: string) {
  const { role, site, user } = await requireSite(siteId);
  if (!canEdit(role)) return;
  await deleteImport(siteId, importId);
  await audit(site.org_id, user.id, "import.deleted", site.domain);
  revalidatePath(`/sites/${siteId}`, "layout");
}

// ---------- billing ----------

export async function startCheckout(plan: string) {
  const { org, role, user } = await requireOrg();
  if (role !== "owner" && role !== "admin") redirect("/settings/billing");
  if (!billingConfigured() || !PAID.includes(plan as Exclude<PlanId, "trial">) || !priceIdFor(plan as PlanId)) redirect("/settings/billing?error=not_configured");
  const [o] = await sql<{ id: string; stripe_customer_id: string | null }[]>`SELECT id, stripe_customer_id FROM organizations WHERE id = ${org.id}`;
  const url = await createCheckout(o!, user.email, priceIdFor(plan as PlanId), process.env.APP_URL ?? "http://localhost:3000");
  redirect(url);
}

export async function openBillingPortal() {
  const { org, role } = await requireOrg();
  const [o] = await sql<{ stripe_customer_id: string | null }[]>`SELECT stripe_customer_id FROM organizations WHERE id = ${org.id}`;
  if ((role !== "owner" && role !== "admin") || !o?.stripe_customer_id || !billingConfigured()) redirect("/settings/billing");
  redirect(await createPortal(o.stripe_customer_id, process.env.APP_URL ?? "http://localhost:3000"));
}

// ---------- password reset ----------

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(`reset:${ip}`, 5, 15 * 60_000)) return { error: "Too many requests. Try again in a few minutes." };
  const [u] = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${email}`;
  if (u && allow(`reset:${email}`, 3, 60 * 60_000)) {
    const token = randomBytes(32).toString("base64url");
    await sql`INSERT INTO password_resets (token_hash, user_id) VALUES (${tokenHash(token)}, ${u.id})`;
    const link = `${process.env.APP_URL ?? ""}/reset-password/${token}`;
    await sendEmail({ to: email, subject: "Reset your Waypoint password", html: layout("Reset your password", "<p>Someone asked to reset the password for this account. The link works for one hour. If it wasn't you, ignore this email.</p>", { href: link, label: "Choose a new password" }), text: `Reset your password: ${link}` });
  }
  return {}; // same answer whether or not the account exists
}

export async function resetPassword(token: string, _: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8 || password.length > 200) return { error: "Password must be at least 8 characters" };
  const [r] = await sql<{ user_id: string }[]>`
    UPDATE password_resets SET used_at = now() WHERE token_hash = ${tokenHash(token)} AND used_at IS NULL AND expires_at > now() RETURNING user_id`;
  if (!r) return { error: "This reset link has expired or was already used. Request a new one." };
  await sql`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${r.user_id}`;
  await sql`DELETE FROM auth_sessions WHERE user_id = ${r.user_id}`; // sign out everywhere
  await startSession(r.user_id);
  redirect("/sites");
}
