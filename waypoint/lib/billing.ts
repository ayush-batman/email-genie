// Stripe billing over its REST API (no SDK needed for three calls), plus usage metering.
import { chQuery, sql } from "./db.ts";
import { PLANS, type PlanId } from "./plans.ts";

const API = () => process.env.STRIPE_API_BASE ?? "https://api.stripe.com";
export const billingConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

/** Flattens nested params into Stripe's form encoding: a[b][0][c]=v */
function form(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe<T>(path: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API()}/v1/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: form(params),
  });
  const json = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Stripe error ${res.status}`);
  return json;
}

export async function createCheckout(org: { id: string; stripe_customer_id: string | null }, email: string, priceId: string, appUrl: string) {
  const s = await stripe<{ url: string }>("checkout/sessions", {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: org.id,
    ...(org.stripe_customer_id ? { customer: org.stripe_customer_id } : { customer_email: email }),
    subscription_data: { metadata: { org_id: org.id } },
    allow_promotion_codes: true,
    success_url: `${appUrl}/settings/billing?upgraded=1`,
    cancel_url: `${appUrl}/settings/billing`,
  });
  return s.url;
}

export async function createPortal(customerId: string, appUrl: string) {
  const s = await stripe<{ url: string }>("billing_portal/sessions", { customer: customerId, return_url: `${appUrl}/settings/billing` });
  return s.url;
}

/** Events recorded this calendar month (UTC) across all of an org's sites, excluding imports and revenue rows. */
export async function monthEvents(orgId: string): Promise<{ total: number; bySite: { site_id: string; n: number }[] }> {
  const sites = await sql<{ id: string }[]>`SELECT id FROM sites WHERE org_id = ${orgId}`;
  if (!sites.length) return { total: 0, bySite: [] };
  const rows = await chQuery<{ site_id: string; n: string }>(
    `SELECT site_id, count() AS n FROM events WHERE site_id IN {ids:Array(UUID)} AND ts >= toStartOfMonth(now()) AND import_id = '' AND type IN ('pageview', 'event')
     GROUP BY site_id`,
    { ids: sites.map((s) => s.id) },
  );
  const bySite = rows.map((r) => ({ site_id: r.site_id, n: Number(r.n) }));
  return { total: bySite.reduce((a, r) => a + r.n, 0), bySite };
}

export async function limits(orgId: string) {
  const [o] = await sql<{ plan: PlanId; sites: number; members: number }[]>`
    SELECT o.plan, (SELECT count(*)::int FROM sites WHERE org_id = o.id) AS sites,
           (SELECT count(*)::int FROM memberships WHERE org_id = o.id) + (SELECT count(*)::int FROM invitations WHERE org_id = o.id AND accepted_at IS NULL AND expires_at > now()) AS members
    FROM organizations o WHERE o.id = ${orgId}`;
  const plan = PLANS[o?.plan && o.plan in PLANS ? o.plan : "trial"];
  return { plan, sites: o?.sites ?? 0, members: o?.members ?? 0 };
}
