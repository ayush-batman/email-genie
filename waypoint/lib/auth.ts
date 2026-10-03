import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { sql, type Site } from "./db.ts";

export { hashPassword, verifyPassword } from "./password.ts";

const COOKIE = "wp_session";
const SESSION_DAYS = 30;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await sql`INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (${sha256(token)}, ${userId}, ${expires})`;
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires, path: "/" });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await sql`DELETE FROM auth_sessions WHERE id = ${sha256(token)}`;
  jar.delete(COOKIE);
}

export type CurrentUser = { id: string; email: string; name: string };

export async function currentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [u] = await sql<CurrentUser[]>`
    SELECT u.id, u.email, u.name FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sha256(token)} AND s.expires_at > now()`;
  return u ?? null;
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export type SiteAccess = { site: Site; role: string };

/** The site if the current user belongs to its org; 404 otherwise (don't leak existence). */
export async function requireSite(siteId: string): Promise<SiteAccess & { user: CurrentUser }> {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) notFound();
  const [row] = await sql<(Site & { role: string })[]>`
    SELECT s.*, m.role FROM sites s JOIN memberships m ON m.org_id = s.org_id AND m.user_id = ${user.id}
    WHERE s.id = ${siteId}`;
  if (!row) notFound();
  const { role, ...site } = row;
  return { site, role, user };
}

/** Public read-only access through a share link. */
export async function siteByShareToken(token: string): Promise<Site | null> {
  const [s] = await sql<Site[]>`SELECT * FROM sites WHERE share_token = ${token}`;
  return s ?? null;
}

export const canEdit = (role: string) => role === "owner" || role === "admin";
