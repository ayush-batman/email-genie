// Records verified payments as `revenue` events attributed to the paying visitor, and the revenue report queries.
import { ch, chQuery, sql } from "./db.ts";
import { DIMENSIONS, type Dimension } from "./query.ts";
import type { EventRow } from "./collect.ts";
import type { CustomerLink, Payment } from "./payments.ts";
import { where, type Scope } from "./stats.ts";

type Touch = Omit<EventRow, "ts" | "type" | "name" | "props" | "revenue_minor" | "revenue_currency" | "engaged_ms">;

/** The visitor's latest non-revenue event at or before `at`: gives the session + last-touch source to attribute to. */
async function lastTouch(siteId: string, p: { visitorId: string; userId: string; sessionId: string }, at: Date): Promise<Touch | null> {
  const by = p.visitorId ? "visitor_id = {v:String}" : p.sessionId ? "session_id = {s:String}" : p.userId ? "user_id = {u:String}" : null;
  if (!by) return null;
  const [row] = await chQuery<Touch>(
    `SELECT * EXCEPT (ts, type, name, props, revenue_minor, revenue_currency, engaged_ms) FROM events
     WHERE site_id = {site:UUID} AND ${by} AND type != 'revenue' AND ts <= parseDateTime64BestEffort({at:String}, 3) + INTERVAL 1 DAY
     ORDER BY ts DESC LIMIT 1`,
    { site: siteId, v: p.visitorId, s: p.sessionId, u: p.userId, at: at.toISOString() },
  );
  if (!row) return null;
  // Revenue rows carry the paying session's landing page, so "landing page" attribution works for both models.
  const [entry] = await chQuery<{ p: string }>(
    `SELECT argMin(url_path, ts) AS p FROM events WHERE site_id = {site:UUID} AND session_id = {s:String} AND type = 'pageview'`,
    { site: siteId, s: row.session_id },
  );
  return { ...row, url_path: entry?.p || row.url_path };
}

const EMPTY_TOUCH: Omit<Touch, "site_id"> = {
  visitor_id: "", session_id: "", user_id: "", hostname: "", url_path: "", title: "", referrer_domain: "", channel: "",
  utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "", country: "", region: "", city: "",
  browser: "", os: "", device: "", screen_bucket: "", language: "",
};

export async function rememberCustomers(siteId: string, provider: string, links: CustomerLink[]) {
  for (const l of links)
    if (l.customerId && (l.visitorId || l.userId))
      await sql`INSERT INTO revenue_customers (site_id, provider, customer_id, visitor_id, user_id)
                VALUES (${siteId}, ${provider}, ${l.customerId}, ${l.visitorId}, ${l.userId})
                ON CONFLICT (site_id, provider, customer_id) DO UPDATE SET
                  visitor_id = COALESCE(NULLIF(EXCLUDED.visitor_id, ''), revenue_customers.visitor_id),
                  user_id = COALESCE(NULLIF(EXCLUDED.user_id, ''), revenue_customers.user_id)`;
}

/** Idempotently records one payment. Returns false if it was a duplicate delivery or a no-op refund. */
export async function recordPayment(siteId: string, provider: string, p: Payment): Promise<boolean> {
  const [fresh] = await sql`INSERT INTO revenue_events (provider, event_id, site_id) VALUES (${provider}, ${p.eventId}, ${siteId}) ON CONFLICT DO NOTHING RETURNING 1`;
  if (!fresh) return false;

  let who = { visitorId: p.visitorId, userId: p.userId, sessionId: p.sessionId };
  if (!who.visitorId && !who.userId && !who.sessionId && p.customerId) {
    const [c] = await sql<{ visitor_id: string; user_id: string }[]>`
      SELECT visitor_id, user_id FROM revenue_customers WHERE site_id = ${siteId} AND provider = ${provider} AND customer_id = ${p.customerId}`;
    if (c) who = { visitorId: c.visitor_id, userId: c.user_id, sessionId: "" };
  }
  await rememberCustomers(siteId, provider, [{ customerId: p.customerId, visitorId: who.visitorId, userId: who.userId }]);

  let amount = p.amount;
  if (p.kind === "refund") {
    // Providers report the cumulative refunded amount; record only what's new for this order.
    const [r] = await chQuery<{ done: string }>(
      `SELECT -sum(revenue_minor) AS done FROM events WHERE site_id = {site:UUID} AND type = 'revenue' AND name = 'refund' AND props['order_id'] = {o:String}`,
      { site: siteId, o: p.orderId },
    );
    amount = p.amount - Number(r?.done ?? 0);
    if (amount <= 0) return false;
  }
  if (!amount) return false;

  const touch = await lastTouch(siteId, who, p.at);
  const row: EventRow = {
    ...EMPTY_TOUCH,
    ...touch,
    site_id: siteId,
    user_id: touch?.user_id || who.userId,
    ts: p.at.toISOString(),
    type: "revenue",
    name: p.kind,
    engaged_ms: 0,
    props: { provider, order_id: p.orderId, ...(p.customerId && { customer_id: p.customerId }) },
    revenue_minor: p.kind === "refund" ? -amount : amount,
    revenue_currency: p.currency,
  };
  await ch.insert({ table: "events", values: [row], format: "JSONEachRow" });
  await sql`UPDATE revenue_connections SET last_event_at = now() WHERE site_id = ${siteId} AND provider = ${provider}`;
  return true;
}

// ---------- report ----------

export type RevenueSummary = {
  revenue: number; newRevenue: number; renewals: number; refunds: number; orders: number; customers: number;
  unattributed: number; visitors: number; aov: number; rpv: number; conversion: number;
  avgDaysToConvert: number | null; avgVisitsToConvert: number | null; otherCurrencies: { currency: string; amount: number }[];
};

export async function revenueSummary(s: Scope): Promise<RevenueSummary> {
  const params: Record<string, unknown> = {};
  const w = where(s, params);
  const [row] = await chQuery<Record<string, string>>(
    `SELECT
       sumIf(revenue_minor, type = 'revenue' AND revenue_currency = {cur:String}) AS revenue,
       sumIf(revenue_minor, type = 'revenue' AND name = 'payment' AND revenue_currency = {cur:String}) AS new_revenue,
       sumIf(revenue_minor, type = 'revenue' AND name = 'renewal' AND revenue_currency = {cur:String}) AS renewals,
       -sumIf(revenue_minor, type = 'revenue' AND name = 'refund' AND revenue_currency = {cur:String}) AS refunds,
       countIf(type = 'revenue' AND name != 'refund' AND revenue_currency = {cur:String}) AS orders,
       uniqExactIf(visitor_id, type = 'revenue' AND name != 'refund' AND visitor_id != '') AS customers,
       sumIf(revenue_minor, type = 'revenue' AND visitor_id = '' AND revenue_currency = {cur:String}) AS unattributed,
       uniqExactIf(visitor_id, type != 'revenue') AS visitors
     FROM events WHERE ${w}`,
    params,
  );
  const n = (k: string) => Number(row?.[k] ?? 0);
  const others = await chQuery<{ currency: string; amount: string }>(
    `SELECT revenue_currency AS currency, sum(revenue_minor) AS amount FROM events
     WHERE ${w} AND type = 'revenue' AND revenue_currency != {cur:String} GROUP BY currency ORDER BY amount DESC`,
    params,
  );
  // Time/visits from a visitor's first ever visit to their first payment in range.
  const [conv] = await chQuery<{ days: string | null; visits: string | null }>(
    `WITH buyers AS (SELECT visitor_id, min(ts) AS paid_at FROM events WHERE ${w} AND type = 'revenue' AND name = 'payment' AND visitor_id != '' GROUP BY visitor_id)
     SELECT avg(dateDiff('second', first_seen, paid_at)) / 86400 AS days, avg(visits) AS visits FROM (
       SELECT b.visitor_id, any(b.paid_at) AS paid_at, min(e.ts) AS first_seen, uniqExactIf(e.session_id, e.ts <= b.paid_at) AS visits
       FROM events e INNER JOIN buyers b ON e.visitor_id = b.visitor_id
       WHERE e.site_id = {site:UUID} AND e.type != 'revenue' GROUP BY b.visitor_id)`,
    params,
  );
  const orders = n("orders"), visitors = n("visitors"), revenue = n("revenue");
  return {
    revenue, newRevenue: n("new_revenue"), renewals: n("renewals"), refunds: n("refunds"), orders, customers: n("customers"),
    unattributed: n("unattributed"), visitors,
    aov: orders ? (n("new_revenue") + n("renewals")) / orders : 0,
    rpv: visitors ? revenue / visitors : 0,
    conversion: visitors ? n("customers") / visitors : 0,
    avgDaysToConvert: conv?.days == null || Number.isNaN(Number(conv.days)) ? null : Number(conv.days),
    avgVisitsToConvert: conv?.visits == null || Number.isNaN(Number(conv.visits)) ? null : Number(conv.visits),
    otherCurrencies: others.map((o) => ({ currency: o.currency, amount: Number(o.amount) })),
  };
}

export type Attribution = "first_touch" | "last_touch";
export type RevenueRow = { value: string; revenue: number; customers: number; orders: number; visitors: number; conversion: number; rpv: number };

/** Revenue by acquisition dimension. Last touch = source of the session that paid; first touch = source of the visitor's first ever visit. */
export async function revenueBy(s: Scope, dim: Dimension, model: Attribution, limit = 20): Promise<RevenueRow[]> {
  const params: Record<string, unknown> = { limit };
  const w = where(s, params);
  const col = DIMENSIONS[dim].column;
  const rev = model === "last_touch"
    ? `SELECT ${col} AS value, sum(revenue_minor) AS revenue, uniqExactIf(visitor_id, name != 'refund') AS customers, countIf(name != 'refund') AS orders
       FROM events WHERE ${w} AND type = 'revenue' AND visitor_id != '' AND revenue_currency = {cur:String} GROUP BY value`
    : `SELECT ft.v AS value, sum(r.revenue_minor) AS revenue, uniqExactIf(r.visitor_id, r.name != 'refund') AS customers, countIf(r.name != 'refund') AS orders
       FROM (SELECT visitor_id, revenue_minor, name FROM events WHERE ${w} AND type = 'revenue' AND visitor_id != '' AND revenue_currency = {cur:String}) AS r
       INNER JOIN (SELECT visitor_id, argMin(${col}, ts) AS v FROM events WHERE site_id = {site:UUID} AND type != 'revenue' GROUP BY visitor_id) AS ft
       ON r.visitor_id = ft.visitor_id GROUP BY value`;
  const visitors = model === "last_touch"
    ? `SELECT ${col} AS value, uniqExact(visitor_id) AS visitors FROM events WHERE ${w} AND type != 'revenue' GROUP BY value`
    : `SELECT v AS value, count() AS visitors FROM (SELECT visitor_id, argMin(${col}, ts) AS v FROM events WHERE ${w} AND type != 'revenue' GROUP BY visitor_id) GROUP BY value`;
  const rows = await chQuery<Record<string, string>>(
    `SELECT r.value AS value, r.revenue AS revenue, r.customers AS customers, r.orders AS orders, v.visitors AS visitors
     FROM (${rev}) AS r LEFT JOIN (${visitors}) AS v ON r.value = v.value
     ORDER BY revenue DESC LIMIT {limit:UInt32}`,
    params,
  );
  return rows.map((r) => {
    const visitorsN = Number(r.visitors ?? 0), customers = Number(r.customers), revenue = Number(r.revenue);
    return { value: r.value ?? "", revenue, customers, orders: Number(r.orders), visitors: visitorsN, conversion: visitorsN ? customers / visitorsN : 0, rpv: visitorsN ? revenue / visitorsN : 0 };
  });
}

export type RevenuePoint = { bucket: string; payment: number; renewal: number; refund: number };

export async function revenueSeries(s: Scope): Promise<RevenuePoint[]> {
  const params: Record<string, unknown> = { tz: s.tz };
  const w = where(s, params);
  const day = s.range.interval === "month" ? "toStartOfMonth" : s.range.interval === "week" ? "toMonday" : "toDate";
  const rows = await chQuery<Record<string, string>>(
    `SELECT ${day}(toDate(ts, {tz:String})) AS bucket,
            sumIf(revenue_minor, name = 'payment') AS payment, sumIf(revenue_minor, name = 'renewal') AS renewal, -sumIf(revenue_minor, name = 'refund') AS refund
     FROM events WHERE ${w} AND type = 'revenue' AND revenue_currency = {cur:String}
     GROUP BY bucket ORDER BY bucket
     WITH FILL FROM ${day}(toDate(parseDateTime64BestEffort({from:String}, 3), {tz:String})) TO toDate(parseDateTime64BestEffort({to:String}, 3), {tz:String}) STEP ${s.range.interval === "month" ? "INTERVAL 1 MONTH" : s.range.interval === "week" ? "INTERVAL 1 WEEK" : "1"}`,
    params,
  );
  return rows.map((r) => ({ bucket: String(r.bucket), payment: Number(r.payment), renewal: Number(r.renewal), refund: Number(r.refund) }));
}

export type RecentPayment = { time: string; name: string; visitor_id: string; user_id: string; channel: string; referrer_domain: string; utm_campaign: string; country: string; revenue_minor: number; revenue_currency: string; provider: string };

export async function recentPayments(s: Scope, limit = 12): Promise<RecentPayment[]> {
  const params: Record<string, unknown> = { limit };
  const rows = await chQuery<RecentPayment>(
    `SELECT toString(ts) AS time, name, visitor_id, user_id, channel, referrer_domain, utm_campaign, country, revenue_minor, revenue_currency, props['provider'] AS provider
     FROM events WHERE ${where(s, params)} AND type = 'revenue' ORDER BY ts DESC LIMIT {limit:UInt32}`,
    params,
  );
  return rows.map((r) => ({ ...r, revenue_minor: Number(r.revenue_minor) }));
}
