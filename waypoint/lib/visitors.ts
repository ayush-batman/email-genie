// Visitor list, profiles and per-visitor data rights (export/delete).
import { ch, chQuery } from "./db.ts";
import { where, type Scope } from "./stats.ts";

export type VisitorRow = {
  visitor_id: string; user_id: string; first_seen: string; last_seen: string; visits: number; pageviews: number;
  channel: string; referrer_domain: string; country: string; device: string; browser: string; revenue: number;
};

export async function listVisitors(s: Scope, opts: { search?: string; limit?: number; offset?: number } = {}): Promise<VisitorRow[]> {
  const params: Record<string, unknown> = { limit: opts.limit ?? 50, offset: opts.offset ?? 0, search: opts.search ?? "" };
  const rows = await chQuery<VisitorRow>(
    `SELECT visitor_id, argMaxIf(user_id, ts, user_id != '') AS user_id,
            toString(min(ts)) AS first_seen, toString(max(ts)) AS last_seen,
            uniqExact(session_id) AS visits, countIf(type = 'pageview') AS pageviews,
            argMin(channel, ts) AS channel, argMin(referrer_domain, ts) AS referrer_domain,
            argMax(country, ts) AS country, argMax(device, ts) AS device, argMax(browser, ts) AS browser,
            sum(revenue_minor) AS revenue
     FROM events WHERE ${where(s, params)}
     GROUP BY visitor_id
     ${opts.search ? "HAVING positionCaseInsensitive(user_id, {search:String}) > 0 OR visitor_id = {search:String}" : ""}
     ORDER BY max(ts) DESC LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
    params,
  );
  return rows.map((r) => ({ ...r, visits: Number(r.visits), pageviews: Number(r.pageviews), revenue: Number(r.revenue) }));
}

export type ProfileEvent = {
  time: string; type: string; name: string; session_id: string; visitor_id: string; user_id: string; url_path: string; title: string;
  channel: string; referrer_domain: string; utm_campaign: string; country: string; city: string; device: string; browser: string; os: string;
  engaged_ms: number; props: Record<string, string>; revenue_minor: number; revenue_currency: string;
};

/** Visitor ids that belong to the same person: the visitor itself plus every visitor identified as the same user_id. */
async function linkedVisitorIds(siteId: string, visitorId: string): Promise<string[]> {
  const rows = await chQuery<{ visitor_id: string }>(
    `SELECT DISTINCT visitor_id FROM events WHERE site_id = {site:UUID} AND (visitor_id = {vid:String} OR user_id IN (
       SELECT user_id FROM events WHERE site_id = {site:UUID} AND visitor_id = {vid:String} AND user_id != ''))`,
    { site: siteId, vid: visitorId },
  );
  return rows.map((r) => r.visitor_id);
}

export type Session = { id: string; start: string; end: string; events: ProfileEvent[] };

export async function visitorProfile(siteId: string, visitorId: string) {
  const ids = await linkedVisitorIds(siteId, visitorId);
  if (!ids.length) return null;
  // ponytail: newest 5,000 events per profile; paginate sessions if heavy users need full history.
  const events = await chQuery<ProfileEvent>(
    `SELECT * FROM (
       SELECT toString(ts) AS time, ts, type, name, session_id, visitor_id, user_id, url_path, title, channel, referrer_domain, utm_campaign,
              country, city, device, browser, os, engaged_ms, props, revenue_minor, revenue_currency
       FROM events WHERE site_id = {site:UUID} AND visitor_id IN {ids:Array(String)} ORDER BY ts DESC LIMIT 5000)
     ORDER BY ts`,
    { site: siteId, ids },
  );
  const sessions = new Map<string, Session>();
  for (const e of events) {
    e.engaged_ms = Number(e.engaged_ms);
    e.revenue_minor = Number(e.revenue_minor);
    // Payments (renewals especially) can happen long after the visit; show them as their own entries.
    const key = e.type === "revenue" ? `pay:${e.time}` : e.session_id;
    const s = sessions.get(key) ?? { id: key, start: e.time, end: e.time, events: [] };
    s.end = e.time;
    s.events.push(e);
    sessions.set(key, s);
  }
  const visible = events.filter((e) => e.type !== "ping");
  const first = visible[0] ?? events[0]!;
  return {
    visitorIds: ids,
    userId: events.findLast((e) => e.user_id)?.user_id ?? "",
    first,
    last: events.at(-1)!,
    sessions: [...sessions.values()].sort((a, b) => b.start.localeCompare(a.start)),
    pageviews: events.filter((e) => e.type === "pageview").length,
    revenue: events.reduce((a, e) => a + e.revenue_minor, 0),
    lastTouch: [...visible].reverse().find((e) => e.type === "pageview" && sessions.get(e.session_id)?.events.find((x) => x.type === "pageview") === e) ?? first,
  };
}

/** GDPR: everything stored about this person, as JSON-able rows. */
export async function exportVisitor(siteId: string, visitorId: string) {
  const ids = await linkedVisitorIds(siteId, visitorId);
  return chQuery<Record<string, unknown>>(
    `SELECT * EXCEPT (site_id) FROM events WHERE site_id = {site:UUID} AND visitor_id IN {ids:Array(String)} ORDER BY ts`,
    { site: siteId, ids },
  );
}

/** GDPR: erase this person (and visitors linked to them via identify). */
export async function deleteVisitor(siteId: string, visitorId: string): Promise<number> {
  const ids = await linkedVisitorIds(siteId, visitorId);
  if (ids.length)
    await ch.command({
      query: "DELETE FROM events WHERE site_id = {site:UUID} AND visitor_id IN {ids:Array(String)}",
      query_params: { site: siteId, ids },
    });
  return ids.length;
}
