// All analytics queries. Every number in the UI comes from one of these functions.
import { ch, chQuery } from "./db.ts";
import { DIMENSIONS, type DateRange, type Dimension, type Filter } from "./query.ts";

export type Scope = { siteId: string; tz: string; range: DateRange; filters: Filter[]; currency?: string };

type Params = Record<string, unknown>;

/** WHERE clause for a scope. Column names come from the DIMENSIONS whitelist; values are bound parameters. */
export function where(s: Scope, params: Params): string {
  params.site = s.siteId;
  params.cur = s.currency ?? "USD";
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

// ---- sessions rollup (fast path) ----
// Dimensions constant within a visit can be answered from the `sessions` table (one row per visit) instead of raw events.
const SESSION_DIMS = new Set<Dimension>(["channel", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "country", "region", "city", "device", "browser", "os", "screen", "language", "entry_page", "exit_page"]);
const usesRollup = (s: Scope) => s.filters.every((f) => SESSION_DIMS.has(f.dim));
const rollupCol = (d: Dimension) => (d === "entry_page" ? "x_entry" : d === "exit_page" ? "x_exit" : `x_${DIMENSIONS[d].column}`);
const rollupExpr = (d: Dimension) => (d === "entry_page" ? "argMinMerge(entry_path)" : d === "exit_page" ? "argMaxMerge(exit_path)" : `any(${DIMENSIONS[d].column})`);

/** One row per visit that started in range, with the requested dimension columns, filtered by the scope's (visit-level) filters. */
function rollup(s: Scope, params: Params, dims: Dimension[] = []): string {
  where(s, params); // binds site/from/to/filter params
  const need = [...new Set([...dims, ...s.filters.map((f) => f.dim)])];
  const cols = need.map((d) => `, ${rollupExpr(d)} AS ${rollupCol(d)}`).join("");
  const having = s.filters.map((f, i) => ` AND ${cond(rollupCol(f.dim), f.op, `f${i}`)}`).join("");
  return `SELECT x_start AS start, x_visitor AS visitor, x_hits AS hits, x_pv AS pv, x_ev AS ev, x_engaged AS engaged, 0 AS revenue${need.map((d) => `, ${rollupCol(d)}`).join("")}
    FROM (SELECT cityHash64(session_id) AS x_key, min(start) AS x_start, any(visitor_id) AS x_visitor, sum(hits) AS x_hits, sum(pv) AS x_pv, sum(ev) AS x_ev, sum(engaged) AS x_engaged${cols}
          FROM sessions
          WHERE site_id = {site:UUID} AND day >= toDate(parseDateTime64BestEffort({from:String}, 3)) - 1 AND day <= toDate(parseDateTime64BestEffort({to:String}, 3))
          GROUP BY x_key
          HAVING x_start >= parseDateTime64BestEffort({from:String}, 3) AND x_start < parseDateTime64BestEffort({to:String}, 3)${having})`;
}

/** Revenue rows matching the scope. Revenue rows carry their visit's source/location columns and its landing page in url_path. */
function revenueWhere(s: Scope, params: Params): string {
  const parts = ["site_id = {site:UUID}", "ts >= parseDateTime64BestEffort({from:String}, 3)", "ts < parseDateTime64BestEffort({to:String}, 3)", "type = 'revenue'", "revenue_currency = {cur:String}"];
  s.filters.forEach((f, i) => {
    if (f.dim === "exit_page") parts.push(`session_id IN (SELECT session_id FROM sessions WHERE site_id = {site:UUID} GROUP BY session_id HAVING ${cond("argMaxMerge(exit_path)", f.op, `f${i}`)})`);
    else parts.push(cond(f.dim === "entry_page" ? "url_path" : DIMENSIONS[f.dim].column, f.op, `f${i}`));
  });
  return parts.join(" AND ");
}

const SESSIONS = (w: string) => `
  SELECT session_id, any(visitor_id) AS visitor, min(ts) AS start,
         countIf(type != 'revenue') AS hits, countIf(type = 'pageview') AS pv, countIf(type = 'event') AS ev,
         sum(engaged_ms) AS engaged, sumIf(revenue_minor, type = 'revenue' AND revenue_currency = {cur:String}) AS revenue
  FROM events WHERE ${w} GROUP BY session_id`;
// Revenue can land in a "session" with no visits in range (renewals, unattributed payments): count its money, not a visit.

const AGGS = `
  uniqIf(visitor, hits > 0) AS visitors, countIf(hits > 0) AS visits, sum(pv) AS pageviews,
  if(visits = 0, 0, pageviews / visits) AS views_per_visit,
  if(visits = 0, 0, countIf(hits > 0 AND pv <= 1 AND ev = 0) / visits) AS bounce_rate,
  if(visits = 0, 0, avgIf(engaged, hits > 0) / 1000) AS visit_duration,
  sum(ev) AS events, sum(revenue) AS revenue`;

export type Kpis = {
  visitors: number; visits: number; pageviews: number; views_per_visit: number;
  bounce_rate: number; visit_duration: number; events: number; revenue: number;
};

const num = <T extends object>(row: T | undefined): T => Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, typeof v === "string" && k !== "bucket" && k !== "value" ? Number(v) : v])) as T;

/** Range totals. Same query as overview(), so the dashboard, API, MCP and emails always agree. */
export async function kpis(s: Scope): Promise<Kpis> {
  return (await overview(s)).totals;
}

export type Point = Kpis & { bucket: string };

const ZERO: Kpis = { visitors: 0, visits: 0, pageviews: 0, views_per_visit: 0, bounce_rate: 0, visit_duration: 0, events: 0, revenue: 0 };

/**
 * Time series bucketed in the site timezone (gaps filled with zeros) plus range totals, in one query (WITH TOTALS).
 * Sessions count toward the bucket they started in. Distinct counts use uniq(): exact up to 65k values, ~1% above.
 */
export async function overview(s: Scope): Promise<{ series: Point[]; totals: Kpis }> {
  return pastRangeCache(["overview", s], () => overviewQuery(s));
}

// Ranges that ended more than a minute ago can't change (except via imports), so cache them briefly.
// ponytail: in-process cache (per instance); fine because finished ranges only change via imports.
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
function pastRangeCache<T>(key: unknown[], fn: () => Promise<T>): Promise<T> {
  const s = key[1] as Scope;
  if (s.range.to.getTime() > Date.now() - 60_000) return fn();
  const k = JSON.stringify(key);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value as Promise<T>;
  const value = fn();
  cache.set(k, { at: Date.now(), value });
  value.catch(() => cache.delete(k));
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return value;
}

async function overviewQuery(s: Scope): Promise<{ series: Point[]; totals: Kpis }> {
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
  const fill = `ORDER BY bucket WITH FILL FROM ${b[1]} TO ${b[2]} STEP ${b[3]}`;
  const run = async (query: string) => (await ch.query({ query, query_params: params, format: "JSON" })).json<Point>();

  if (!usesRollup(s)) {
    const res = await run(`SELECT ${b[0]} AS bucket, ${AGGS} FROM (${SESSIONS(w)}) GROUP BY bucket WITH TOTALS ${fill}`);
    const { bucket: _b, ...kpis } = res.totals ? num(res.totals as Point) : { ...ZERO, bucket: "" };
    return { series: res.data.map(num), totals: { ...ZERO, ...kpis } };
  }
  const r = await rollupStats(s, []);
  return { series: r.series, totals: r.totals };
}

const bucketSql = (s: Scope, col: "start" | "ts") => {
  const t = `toDateTime(${col}, {tz:String})`, d = `toDate(${col}, {tz:String})`;
  return { minute: `toStartOfMinute(${t})`, hour: `toStartOfHour(${t})`, day: d, week: `toMonday(${d})`, month: `toStartOfMonth(${d})` }[s.range.interval];
};

/**
 * Series, totals and top values of several visit-level dimensions from ONE scan of the sessions rollup (GROUPING SETS),
 * plus revenue from events the same way. Only valid when usesRollup(s).
 */
async function rollupStats(s: Scope, dims: Dimension[], limit = 9): Promise<{ series: Point[]; totals: Kpis; panels: Map<Dimension, BreakdownRow[]> }> {
  const params: Params = { tz: s.tz };
  const sets = ["(bucket)", "()", ...dims.map((d) => `(${rollupCol(d)})`)].join(", ");
  // grouping(col) = 0 when col is part of the row's grouping set (SQL standard), which tells the sets apart.
  const flags = ["bucket", ...dims.map(rollupCol)].map((c) => `, grouping(${c}) AS g_${c}`).join("");
  const revCol = (d: Dimension) => (d === "entry_page" ? "url_path" : d === "exit_page" ? "'—'" : DIMENSIONS[d].column);
  const from = "parseDateTime64BestEffort({from:String}, 3)", to = "parseDateTime64BestEffort({to:String}, 3)";
  const seed = { minute: `toStartOfMinute(toDateTime(${from}, {tz:String}))`, hour: `toStartOfHour(toDateTime(${from}, {tz:String}))`, day: `toDate(${from}, {tz:String})`, week: `toMonday(toDate(${from}, {tz:String}))`, month: `toStartOfMonth(toDate(${from}, {tz:String}))` }[s.range.interval];
  const end = s.range.interval === "minute" || s.range.interval === "hour" ? `toDateTime(${to}, {tz:String})` : `toDate(${to}, {tz:String})`;
  const step = { minute: "INTERVAL 1 MINUTE", hour: "INTERVAL 1 HOUR", day: "1", week: "INTERVAL 1 WEEK", month: "INTERVAL 1 MONTH" }[s.range.interval];

  type Row = Record<string, string | number | null>;
  const [visits, money, buckets] = await Promise.all([
    chQuery<Row>(
      `SELECT ${bucketSql(s, "start")} AS bucket${dims.map((d) => `, ${rollupCol(d)}`).join("")}, ${AGGS}
${flags} FROM (${rollup(s, params, dims)}) GROUP BY GROUPING SETS (${sets})`, params),
    chQuery<Row>(
      `SELECT ${bucketSql(s, "ts")} AS bucket${dims.map((d) => `, ${revCol(d)} AS ${rollupCol(d)}`).join("")}, sum(revenue_minor) AS revenue
${flags} FROM events WHERE ${revenueWhere(s, params)} GROUP BY GROUPING SETS (${sets})`, params),
    chQuery<{ bucket: string }>(`SELECT ${seed} AS bucket ORDER BY bucket WITH FILL FROM ${seed} TO ${end} STEP ${step}`, params),
  ]);
  const keyOf = (r: Row) => (Number(r.g_bucket) === 0 ? "bucket" : dims.find((d) => Number(r[`g_${rollupCol(d)}`]) === 0) ?? "total");
  const rev = new Map<string, number>(money.map((r) => [`${keyOf(r)}|${keyOf(r) === "bucket" ? r.bucket : keyOf(r) === "total" ? "" : r[rollupCol(keyOf(r) as Dimension)]}`, Number(r.revenue)]));
  const totalsRow = visits.find((r) => keyOf(r) === "total");
  const pick = (r: Row | undefined): Kpis => Object.fromEntries((Object.keys(ZERO) as (keyof Kpis)[]).map((k) => [k, Number(r?.[k] ?? 0)])) as Kpis;
  const totals = { ...pick(totalsRow), revenue: rev.get("total|") ?? 0 };
  const byBucket = new Map(visits.filter((r) => keyOf(r) === "bucket").map((r) => [String(r.bucket), r]));
  const series = buckets.map(({ bucket }) => {
    const r = byBucket.get(String(bucket));
    return { ...pick(r), bucket: String(bucket), revenue: rev.get(`bucket|${bucket}`) ?? 0 };
  });
  const panels = new Map<Dimension, BreakdownRow[]>();
  for (const d of dims) {
    const rows = visits
      .filter((r) => keyOf(r) === d)
      .map((r) => ({ value: String(r[rollupCol(d)]), visitors: Number(r.visitors), count: Number(r.visits), revenue: rev.get(`${d}|${r[rollupCol(d)]}`) ?? 0, share: totals.visitors ? Number(r.visitors) / totals.visitors : 0 }))
      .sort((a, b) => b.visitors - a.visitors || b.count - a.count || a.value.localeCompare(b.value));
    panels.set(d, rows.slice(0, limit));
  }
  return { series, totals, panels };
}

/** The dashboard's numbers in as few scans as possible: totals, series and the given breakdown panels. */
export async function dashboardStats(s: Scope, dims: (Dimension | `prop:${string}`)[], limit = 9) {
  const visitLevel = usesRollup(s) ? (dims.filter((d) => SESSION_DIMS.has(d as Dimension)) as Dimension[]) : [];
  const main = usesRollup(s)
    ? pastRangeCache(["dash", s, visitLevel, limit], () => rollupStats(s, visitLevel, limit))
    : overview(s).then((o) => ({ ...o, panels: new Map<Dimension, BreakdownRow[]>() }));
  const { series, totals, panels } = await main;
  const rest = await Promise.all(dims.map((d) => (panels.has(d as Dimension) ? panels.get(d as Dimension)! : breakdown(s, d, limit, 0, "", totals.visitors))));
  return { series, totals, panels: dims.map((d, i) => ({ dim: d, rows: rest[i]! })) };
}

export async function timeseries(s: Scope): Promise<Point[]> {
  return (await overview(s)).series;
}

export type BreakdownRow = { value: string; visitors: number; count: number; share: number; revenue: number };

/** Top values of a dimension. `totalVisitors` (for the share column) can be passed in to avoid another scan. */
export async function breakdown(s: Scope, dim: Dimension | `prop:${string}`, limit = 10, offset = 0, search = "", totalVisitors?: number): Promise<BreakdownRow[]> {
  const params: Params = { limit, offset, search };
  const w = where(s, params);
  const searchCond = search ? "AND positionCaseInsensitive(value, {search:String}) > 0" : "";
  let q: string;

  if (!dim.startsWith("prop:") && SESSION_DIMS.has(dim as Dimension) && usesRollup(s)) {
    const d = dim as Dimension;
    const revCol = d === "entry_page" ? "url_path" : d === "exit_page" ? "''" : DIMENSIONS[d].column;
    const [rows, money, total] = await Promise.all([
      chQuery<BreakdownRow>(
        `SELECT ${rollupCol(d)} AS value, uniq(visitor) AS visitors, count() AS count FROM (${rollup(s, params, [d])})
         GROUP BY value HAVING visitors > 0 ${searchCond} ORDER BY visitors DESC, count DESC, value LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
        params,
      ),
      chQuery<{ value: string; revenue: string }>(`SELECT ${revCol} AS value, sum(revenue_minor) AS revenue FROM events WHERE ${revenueWhere(s, params)} GROUP BY value`, params),
      totalVisitors ?? chQuery<{ n: string }>(`SELECT uniq(visitor) AS n FROM (${rollup(s, params)})`, params).then((r) => Number(r[0]?.n ?? 0)),
    ]);
    const rev = new Map(money.map((m) => [m.value, Number(m.revenue)]));
    return rows.map((r) => {
      const row = num(r);
      return { ...row, revenue: rev.get(row.value) ?? 0, share: total ? row.visitors / total : 0 };
    });
  }

  if (dim.startsWith("prop:")) {
    params.prop = dim.slice(5);
    q = `SELECT props[{prop:String}] AS value, uniq(visitor_id) AS visitors, count() AS count, sumIf(revenue_minor, type = 'revenue' AND revenue_currency = {cur:String}) AS revenue
         FROM events WHERE ${w} AND type = 'event' AND mapContains(props, {prop:String}) GROUP BY value`;
  } else if (dim === "entry_page" || dim === "exit_page") {
    const pick = dim === "entry_page" ? "argMin" : "argMax";
    q = `SELECT value, uniq(visitor) AS visitors, count() AS count, sum(rev) AS revenue FROM (
           SELECT session_id, any(visitor_id) AS visitor, ${pick}If(url_path, ts, type = 'pageview') AS value, sumIf(revenue_minor, type = 'revenue' AND revenue_currency = {cur:String}) AS rev
           FROM events WHERE ${w} GROUP BY session_id HAVING countIf(type = 'pageview') > 0) GROUP BY value`;
  } else {
    const col = DIMENSIONS[dim as Dimension].column;
    const pageLike = dim === "page" || dim === "title" || dim === "hostname";
    const typeCond = dim === "event" ? "AND type = 'event'" : pageLike ? "AND type = 'pageview'" : "AND type != 'ping'";
    const count = dim === "event" || pageLike ? "count()" : "uniqIf(session_id, type != 'revenue')";
    q = `SELECT ${col} AS value, uniqIf(visitor_id, type != 'revenue') AS visitors, ${count} AS count, sumIf(revenue_minor, type = 'revenue' AND revenue_currency = {cur:String}) AS revenue
         FROM events WHERE ${w} ${typeCond} GROUP BY value`;
  }
  const [rows, total] = await Promise.all([
    chQuery<BreakdownRow>(
      `SELECT value, visitors, count, revenue FROM (${q}) WHERE visitors > 0 ${searchCond}
       ORDER BY visitors DESC, count DESC, value LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
      params,
    ),
    totalVisitors ?? chQuery<{ n: string }>(`SELECT uniqIf(visitor_id, type != 'revenue') AS n FROM events WHERE ${w}`, params).then((r) => Number(r[0]?.n ?? 0)),
  ]);
  return rows.map((r) => {
    const row = num(r);
    return { ...row, share: total ? row.visitors / total : 0 };
  });
}

/** Visitors active in the last 5 minutes. */
export async function onlineNow(siteId: string): Promise<number> {
  const [r] = await chQuery<{ n: string }>(
    `SELECT uniq(visitor_id) AS n FROM events WHERE site_id = {site:UUID} AND ts > now() - INTERVAL 5 MINUTE`,
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
  return ["value,visitors,count,share,revenue_minor", ...rows.map((r) => [r.value, r.visitors, r.count, r.share.toFixed(4), r.revenue].map(esc).join(","))].join("\n");
}

export type Goal = { id: string; name: string; kind: "pageview" | "event"; match: string };
export type GoalStat = Goal & { visitors: number; completions: number; rate: number };

/** Completions per goal. Pageview goals match a path exactly, or as a prefix when they end in `*`. */
export async function goalStats(s: Scope, goals: Goal[]): Promise<GoalStat[]> {
  if (!goals.length) return [];
  const params: Params = {};
  const w = where(s, params);
  const conds = goals.map((g, i) => {
    params[`g${i}`] = g.match.replace(/\*$/, "");
    if (g.kind === "event") return `type = 'event' AND name = {g${i}:String}`;
    return g.match.endsWith("*") ? `type = 'pageview' AND startsWith(url_path, {g${i}:String})` : `type = 'pageview' AND url_path = {g${i}:String}`;
  });
  const cols = conds.map((c, i) => `uniqIf(visitor_id, ${c}) AS v${i}, countIf(${c}) AS c${i}`).join(", ");
  const [row] = await chQuery<Record<string, string>>(`SELECT uniq(visitor_id) AS total, ${cols} FROM events WHERE ${w}`, params);
  const total = Number(row?.total ?? 0);
  return goals.map((g, i) => {
    const visitors = Number(row?.[`v${i}`] ?? 0);
    return { ...g, visitors, completions: Number(row?.[`c${i}`] ?? 0), rate: total ? visitors / total : 0 };
  });
}

/** Property keys recorded on an event, most common first. */
export async function eventPropKeys(s: Scope, event: string): Promise<{ key: string; count: number }[]> {
  const params: Params = { ev: event };
  const rows = await chQuery<{ key: string; count: string }>(
    `SELECT arrayJoin(mapKeys(props)) AS key, count() AS count FROM events WHERE ${where(s, params)} AND type = 'event' AND name = {ev:String}
     GROUP BY key ORDER BY count DESC LIMIT 30`,
    params,
  );
  return rows.map((r) => ({ key: r.key, count: Number(r.count) }));
}
