"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEdit, endSession, hashPassword, requireSite, requireUser, startSession, verifyPassword } from "@/lib/auth.ts";
import { ch, sql } from "@/lib/db.ts";
import { deleteVisitor } from "@/lib/visitors.ts";
import { encrypt } from "@/lib/crypto.ts";

export type FormState = { error?: string } | undefined;

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.extend({ name: z.string().trim().max(100) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { email, password, name } = parsed.data;
  const hash = await hashPassword(password);
  const userId = await sql.begin(async (tx) => {
    const [u] = await tx<{ id: string }[]>`INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name}, ${hash}) ON CONFLICT (email) DO NOTHING RETURNING id`;
    if (!u) return null;
    const [o] = await tx<{ id: string }[]>`INSERT INTO organizations (name) VALUES (${name ? `${name}'s team` : "My team"}) RETURNING id`;
    await tx`INSERT INTO memberships (org_id, user_id, role) VALUES (${o!.id}, ${u.id}, 'owner')`;
    return u.id;
  });
  if (!userId) return { error: "An account with this email already exists" };
  await startSession(userId);
  redirect("/sites/new");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Invalid email or password" };
  const [u] = await sql<{ id: string; password_hash: string }[]>`SELECT id, password_hash FROM users WHERE email = ${parsed.data.email}`;
  // ponytail: no lockout/captcha yet; add rate limiting on this action before public launch.
  if (!u || !(await verifyPassword(parsed.data.password, u.password_hash))) return { error: "Invalid email or password" };
  await startSession(u.id);
  redirect("/sites");
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
  const { name, domain, timezone, mode, currency } = parsed.data;
  const [site] = await sql<{ id: string }[]>`
    INSERT INTO sites (org_id, public_id, name, domain, timezone, mode, currency)
    VALUES (${m.org_id}, ${randomBytes(6).toString("base64url")}, ${name}, ${domain}, ${timezone}, ${mode}, ${currency}) RETURNING id`;
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
  const { site, role } = await requireSite(siteId);
  if (!canEdit(role)) return;
  const token = site.share_token ? null : randomBytes(18).toString("base64url");
  await sql`UPDATE sites SET share_token = ${token} WHERE id = ${siteId}`;
  revalidatePath(`/sites/${siteId}/settings`);
}

export async function deleteSite(siteId: string, form: FormData) {
  const { site, role } = await requireSite(siteId);
  if (!canEdit(role) || form.get("confirm") !== site.domain) return;
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
  const { role } = await requireSite(siteId);
  if (!canEdit(role)) return { error: "Only owners and admins can connect payments" };
  if (!(PAYMENT_PROVIDERS as readonly string[]).includes(provider)) return { error: "Unknown provider" };
  const secret = String(form.get("secret") ?? "").trim();
  if (secret.length < 6 || secret.length > 500) return { error: "Paste the webhook signing secret" };
  if (provider === "stripe" && !secret.startsWith("whsec_")) return { error: "Stripe signing secrets start with whsec_" };
  await sql`INSERT INTO revenue_connections (site_id, provider, secret_enc) VALUES (${siteId}, ${provider}, ${encrypt(secret)})
            ON CONFLICT (site_id, provider) DO UPDATE SET secret_enc = EXCLUDED.secret_enc`;
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
  const { role } = await requireSite(siteId);
  if (!canEdit(role)) return { error: "Only owners and admins can create API keys" };
  const key = `wp_sk_${randomBytes(24).toString("base64url")}`;
  await sql`INSERT INTO revenue_connections (site_id, provider, secret_enc) VALUES (${siteId}, 'api', ${encrypt(key)})
            ON CONFLICT (site_id, provider) DO UPDATE SET secret_enc = EXCLUDED.secret_enc, last_event_at = NULL`;
  revalidatePath(`/sites/${siteId}/settings`);
  return { key };
}
