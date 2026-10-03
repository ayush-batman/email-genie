"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEdit, endSession, hashPassword, requireSite, requireUser, startSession, verifyPassword } from "@/lib/auth.ts";
import { ch, sql } from "@/lib/db.ts";

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
});

export async function createSite(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = siteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const [m] = await sql<{ org_id: string }[]>`SELECT org_id FROM memberships WHERE user_id = ${user.id} AND role IN ('owner', 'admin') LIMIT 1`;
  if (!m) return { error: "You need an owner or admin role to add sites" };
  const { name, domain, timezone, mode } = parsed.data;
  const [site] = await sql<{ id: string }[]>`
    INSERT INTO sites (org_id, public_id, name, domain, timezone, mode)
    VALUES (${m.org_id}, ${randomBytes(6).toString("base64url")}, ${name}, ${domain}, ${timezone}, ${mode}) RETURNING id`;
  redirect(`/sites/${site!.id}/settings?welcome=1`);
}

export async function updateSite(siteId: string, _: FormState, form: FormData): Promise<FormState> {
  const { role } = await requireSite(siteId);
  if (!canEdit(role)) return { error: "Only owners and admins can change settings" };
  const parsed = siteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { name, domain, timezone, mode } = parsed.data;
  await sql`UPDATE sites SET name = ${name}, domain = ${domain}, timezone = ${timezone}, mode = ${mode} WHERE id = ${siteId}`;
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
