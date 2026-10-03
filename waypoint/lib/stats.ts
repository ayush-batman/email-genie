// All analytics queries. Every number in the UI comes from one of these functions.
import { chQuery } from "./db.ts";
import { DIMENSIONS, type DateRange, type Dimension, type Filter } from "./query.ts";

export type Scope = { siteId: string; tz: string; range: DateRange; filters: Filter[] };

type Params = Record<string, unknown>;

/** WHERE clause for a scope. Column names come from the DIMENSIONS whitelist; values are bound parameters. */
function where(s: Scope, params: Params): string {
  params.site = s.siteId;
  params.from = s.range.from.toISOString();
  params.to = s.range.to.toISOString();
  const parts = ["site_id = {site:UUID}", "ts >= parseDateTime64BestEffort({from:String}, 3)", "ts < parseDateTime64BestEffort({to:String}, 3)"];
  s.filters.forEach((f, i) => {
    const key = `f${i}`;
    params[key] = f.value;
    const def = DIMENSIONS[f.dim];
    if ("session" in def) {
      // entry/exit page: keep sessions whose first/last pageview matches.
      const pick = f.dim === "entry_page" ? "argMin" : "argMax";
      parts.push(
        `session_id IN (SELECT session_id FROM events WHERE site_id = {site:UUID} AND type = 'pageview' AND ts >= parseDateTime64BestEffort({from:String}, 3) AND ts < parseDateTime64BestEffort({to:String}, 3) GROUP BY session_id HAVING ${cond(`${pick}(url_path, ts)`, f.op, key)})`,
      );
    } else {
      parts.push(cond(def.column, f.op, key));
    }
  });
  return parts.join(" AND ");
}

function cond(expr: string, op: Filter["op"], key: string): string {
  switch (op) {
    case "is": return `${expr} = {${key}:String}`;
    case "is_not": return `${expr} != {${key}:String}`;
    case "contains": return `positionCaseInsensitive(${expr}, {${key}:String}) > 0`;
    case "not_contains": return `positionCaseInsensitive(${expr}, {${key}:String}) = 0`;
  }
}

const SESSIONS = (w: string) => `
  SELECT session_id, any(visitor_id) AS visitor, min(ts) AS start,
         countIf(type = 'pageview') AS pv, countIf(type = 'event') AS ev,
         sum(engaged_ms) AS engaged, sum(revenue_minor) AS revenue
  FROM events WHERE ${w} GROUP BY session_id`;

const AGGS = `
  uniqExact(visitor) AS visitors, count() AS visits, sum(pv) AS pageviews,
  if(visits = 0, 0, pageviews / visits) AS views_per_visit,
  if(visits = 0, 0, countIf(pv <= 1 AND ev = 0) / visits) AS bounce_rate,
  if(visits = 0, 0, avg(engaged) / 1000) AS visit_duration,
  sum(ev) AS events, sum(revenue) AS revenue`;

export type Kpis = {
  visitors: number; visits: number; pageviews: number; views_per_visit: number;
  bounce_rate: number; visit_duration: number; events: number; revenue: number;
};

const num = <T extends object>(row: T | undefined): T => Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, typeof v === "string" && k !== "bucket" && k !== "value" ? Number(v) : v])) as T;

export async function kpis(s: Scope): Promise<Kpis> {
  const params: Params = {};
  const [row] = await chQuery<Kpis>(`SELECT ${AGGS} FROM (${SESSIONS(where(s, params))})`, params);
  return num(row ?? ({ visitors: 0, visits: 0, pageviews: 0, views_per_visit: 0, bounce_rate: 0, visit_duration: 0, events: 0, revenue: 0 } as Kpis));
}

export type Point = Kpis & { bucket: string };

/** Time series bucketed in the site timezone, gaps filled with zeros. Sessions count toward the bucket they started in. */
export async function timeseries(s: Scope): Promise<Point[]> {
  const params: Params = { tz: s.tz };
  const w = where(s, params);
  const from = "parseDateTime64BestEffort({from:String}, 3)";
  const to = "parseDateTime64BestEffort({to:String}, 3)";
  const b = {
    minute: [`toStartOfMinute(toDateTime(start, {tz:String}))`, `toStartOfMinute(toDateTime(${from}, {tz:String}))`, `toDateTime(${to}, {tz:String})`, "INTERVAL 1 MINUTE"],
    hour: [`toStartOfHour(toDateTime(start, {tz:String}))`, `toStartOfHour(toDateTime(${from}, {tz:String}))`, `toDateTime(${to}, {tz:String})`, "INTERVAL 1 HOUR"],
    day: [`toDate(start, {tz:String})`, `toDate(${from}, {tz:String})`, `toDate(${to}, {tz:String})`, "1"],
    week: [`toMonday(toDate(start, {tz:String}))`, `toMonday(toDate(${from}, {tz:String}))`, `toDate(${to}, {tz:String})`, "INTERVAL 1 WEEK"],
    month: [`toStartOfMonth(toDate(start, {tz:String}))`, `toStartOfMonth(toDate(${from}, {tz:String}))`, `toDate(${to}, {tz:String})`, "INTERVAL 1 MONTH"],
  }[s.range.interval];
  const rows = await chQuery<Point>(
    `SELECT ${b[0]} AS bucket, ${AGGS} FROM (${SESSIONS(w)})
     GROUP BY bucket ORDER BY bucket WITH FILL FROM ${b[1]} TO ${b[2]} STEP ${b[3]}`,
    params,
  );
  return rows.map(num);
}

export type BreakdownRow = { value: string; visitors: number; count: number; share: number };

/** Top values of a dimension. `count` = pageviews for page dims, events for `event`, visits otherwise. */
export async function breakdown(s: Scope, dim: Dimension | `prop:${string}`, limit = 10, offset = 0, search = ""): Promise<BreakdownRow[]> {
  const params: Params = { limit, offset, search };
  const w = where(s, params);
  const searchCond = search ? "AND positionCaseInsensitive(value, {search:String}) > 0" : "";
  let q: string;

  if (dim.startsWith("prop:")) {
    params.prop = dim.slice(5);
    q = `SELECT props[{prop:String}] AS value, uniqExact(visitor_id) AS visitors, count() AS count
         FROM events WHERE ${w} AND type = 'event' AND mapContains(props, {prop:String}) GROUP BY value`;
  } else if (dim === "entry_page" || dim === "exit_page") {
    const pick = dim === "entry_page" ? "argMin" : "argMax";
    q = `SELECT value, uniqExact(visitor) AS visitors, count() AS count FROM (
           SELECT session_id, any(visitor_id) AS visitor, ${pick}(url_path, ts) AS value
           FROM events WHERE ${w} AND type = 'pageview' GROUP BY session_id) GROUP BY value`;
  } else {
    const col = DIMENSIONS[dim as Dimension].column;
    const pageLike = dim === "page" || dim === "title" || dim === "hostname";
    const typeCond = dim === "event" ? "AND type = 'event'" : pageLike ? "AND type = 'pageview'" : "AND type != 'ping'";
    const count = dim === "event" || pageLike ? "count()" : "uniqExact(session_id)";
    q = `SELECT ${col} AS value, uniqExact(visitor_id) AS visitors, ${count} AS count FROM events WHERE ${w} ${typeCond} GROUP BY value`;
  }
  const total = `(SELECT uniqExact(visitor_id) FROM events WHERE ${w})`;
  const rows = await chQuery<BreakdownRow>(
    `SELECT value, visitors, count, if(${total} = 0, 0, visitors / ${total}) AS share
     FROM (${q}) WHERE 1 ${searchCond} ORDER BY visitors DESC, count DESC, value LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
    params,
  );
  return rows.map((r) => num(r));
}

/** Visitors active in the last 5 minutes. */
export async function onlineNow(siteId: string): Promise<number> {
  const [r] = await chQuery<{ n: string }>(
    `SELECT uniqExact(visitor_id) AS n FROM events WHERE site_id = {site:UUID} AND ts > now() - INTERVAL 5 MINUTE`,
    { site: siteId },
  );
  return Number(r?.n ?? 0);
}

export type FeedItem = {
  time: string; type: string; name: string; visitor_id: string; url_path: string; country: string;
  city: string; device: string; browser: string; channel: string; referrer_domain: string; props: Record<string, string>;
};

/** Latest events (newest first), optionally only those after `since` (ISO). */
export async function liveFeed(siteId: string, since?: string, limit = 50): Promise<FeedItem[]> {
  return chQuery<FeedItem>(
    `SELECT toString(ts) AS time, type, name, visitor_id, url_path, country, city, device, browser, channel, referrer_domain, props
     FROM events WHERE site_id = {site:UUID} AND type != 'ping' AND ts > now() - INTERVAL 1 DAY
       ${since ? "AND ts > parseDateTime64BestEffort({since:String}, 3)" : ""}
     ORDER BY ts DESC LIMIT {limit:UInt32}`,
    { site: siteId, since: since ?? "", limit },
  );
}

export async function firstEventAt(siteId: string): Promise<Date | null> {
  const [r] = await chQuery<{ t: string; n: string }>(
    `SELECT toString(min(ts)) AS t, count() AS n FROM events WHERE site_id = {site:UUID}`,
    { site: siteId },
  );
  return r && Number(r.n) > 0 ? new Date(r.t.replace(" ", "T") + "Z") : null;
}

/** Rows for CSV export of one breakdown (up to 10k). */
export async function exportBreakdown(s: Scope, dim: Dimension | `prop:${string}`): Promise<string> {
  const rows = await breakdown(s, dim, 10_000);
  const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return ["value,visitors,count,share", ...rows.map((r) => [r.value, r.visitors, r.count, r.share.toFixed(4)].map(esc).join(","))].join("\n");
}
