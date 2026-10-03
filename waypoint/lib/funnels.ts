// Funnels and retention. Steps are matched per visitor, in order, within a conversion window.
import { chQuery } from "./db.ts";
import { DIMENSIONS, type Dimension } from "./query.ts";
import { where, type Scope } from "./stats.ts";

export type Step = { kind: "pageview" | "event"; match: string; label?: string };
export type Funnel = { id: string; name: string; steps: Step[]; window_hours: number };

export const stepLabel = (s: Step) => s.label || (s.kind === "event" ? s.match : `Visited ${s.match}`);

function stepCond(s: Step, i: number, params: Record<string, unknown>): string {
  params[`s${i}`] = s.match.replace(/\*$/, "");
  if (s.kind === "event") return `(type = 'event' AND name = {s${i}:String})`;
  return s.match.endsWith("*") ? `(type = 'pageview' AND startsWith(url_path, {s${i}:String}))` : `(type = 'pageview' AND url_path = {s${i}:String})`;
}

/**
 * Per-visitor step timestamps: t1 = first step-1 hit, t_k = first step-k hit at/after t_{k-1}, all within the window from t1.
 * level = how many steps the visitor completed in order.
 * ponytail: greedy from the earliest step-1 hit; a visitor whose later start would complete more steps is undercounted. windowFunnel() fixes that if it matters.
 */
function perVisitor(s: Scope, f: Funnel, params: Record<string, unknown>, breakdownExpr = "") {
  const w = where(s, params);
  params.win = f.window_hours * 3600;
  const conds = f.steps.map((st, i) => stepCond(st, i, params));
  const arrays = conds.map((c, i) => `arraySort(groupArrayIf(toUnixTimestamp64Milli(ts), ${c})) AS a${i}`).join(", ");
  const ts = f.steps
    .map((_, i) => (i === 0 ? `if(empty(a0), 0, a0[1]) AS t0` : `if(t${i - 1} = 0, 0, arrayFirst(x -> x >= t${i - 1} AND x - t0 <= {win:UInt32} * 1000, a${i})) AS t${i}`))
    .join(", ");
  const level = f.steps.map((_, i) => `(t${i} > 0)`).join(" + ");
  const bd = breakdownExpr ? `, ${breakdownExpr} AS bd` : "";
  return `SELECT visitor_id, ${ts}, ${level} AS level ${breakdownExpr ? ", bd" : ""}
          FROM (SELECT visitor_id, ${arrays} ${bd}
                FROM events WHERE ${w} AND type IN ('pageview', 'event') GROUP BY visitor_id)
          WHERE t0 > 0`;
}

export type FunnelStepResult = { label: string; visitors: number; ofFirst: number; ofPrev: number; dropped: number; medianSecs: number | null };

export async function runFunnel(s: Scope, f: Funnel): Promise<FunnelStepResult[]> {
  const params: Record<string, unknown> = {};
  const n = f.steps.length;
  const reached = f.steps.map((_, i) => `countIf(level >= ${i + 1}) AS r${i}`).join(", ");
  const medians = f.steps.slice(1).map((_, i) => `quantileIf(0.5)((t${i + 1} - t${i}) / 1000, t${i + 1} > 0) AS m${i + 1}`).join(", ");
  const [row] = await chQuery<Record<string, string | null>>(`SELECT ${reached}${medians ? `, ${medians}` : ""} FROM (${perVisitor(s, f, params)})`, params);
  const counts = Array.from({ length: n }, (_, i) => Number(row?.[`r${i}`] ?? 0));
  return f.steps.map((st, i) => {
    const m = row?.[`m${i}`];
    return {
      label: stepLabel(st),
      visitors: counts[i]!,
      ofFirst: counts[0] ? counts[i]! / counts[0] : 0,
      ofPrev: i === 0 ? 1 : counts[i - 1] ? counts[i]! / counts[i - 1]! : 0,
      dropped: i === 0 ? 0 : counts[i - 1]! - counts[i]!,
      medianSecs: i === 0 || m == null || Number.isNaN(Number(m)) ? null : Number(m),
    };
  });
}

export type BreakdownFunnelRow = { value: string; started: number; completed: number; rate: number };

/** Conversion by the visitor's first-touch value of a dimension. */
export async function funnelBreakdown(s: Scope, f: Funnel, dim: Dimension, limit = 8): Promise<BreakdownFunnelRow[]> {
  const params: Record<string, unknown> = { limit };
  const col = DIMENSIONS[dim].column;
  const n = f.steps.length;
  const rows = await chQuery<Record<string, string>>(
    `SELECT bd AS value, count() AS started, countIf(level >= ${n}) AS completed
     FROM (${perVisitor(s, f, params, `argMin(${col}, ts)`)})
     GROUP BY value ORDER BY started DESC LIMIT {limit:UInt32}`,
    params,
  );
  return rows.map((r) => ({ value: r.value ?? "", started: Number(r.started), completed: Number(r.completed), rate: Number(r.started) ? Number(r.completed) / Number(r.started) : 0 }));
}

export type DropOff = { visitors: { visitor_id: string; at: string }[]; nextPages: { path: string; visitors: number }[] };

/** Who stopped after step `step` (1-based), and where they went instead. */
export async function dropOff(s: Scope, f: Funnel, step: number): Promise<DropOff> {
  const params: Record<string, unknown> = { lvl: step };
  const inner = perVisitor(s, f, params);
  const t = `t${step - 1}`;
  const [visitors, nextPages] = await Promise.all([
    chQuery<{ visitor_id: string; at: string }>(
      `SELECT visitor_id, toString(fromUnixTimestamp64Milli(${t})) AS at FROM (${inner}) WHERE level = {lvl:UInt8} ORDER BY ${t} DESC LIMIT 30`, params),
    chQuery<{ path: string; visitors: string }>(
      `SELECT e.url_path AS path, uniq(e.visitor_id) AS visitors
       FROM events e INNER JOIN (SELECT visitor_id, ${t} AS t FROM (${inner}) WHERE level = {lvl:UInt8}) d ON e.visitor_id = d.visitor_id
       WHERE e.site_id = {site:UUID} AND e.type = 'pageview' AND toUnixTimestamp64Milli(e.ts) > d.t
       GROUP BY path ORDER BY visitors DESC LIMIT 8`, params),
  ]);
  return { visitors, nextPages: nextPages.map((p) => ({ path: p.path, visitors: Number(p.visitors) })) };
}

export type Cohort = { week: string; size: number; retained: number[] };

/** Weekly retention: of visitors first seen in week W, the share active again in week W+k. Needs Product mode (stable visitor ids). */
export async function retention(siteId: string, tz: string, weeks = 8): Promise<Cohort[]> {
  const rows = await chQuery<{ week: string; k: string; n: string }>(
    `WITH firsts AS (
       SELECT visitor_id, toMonday(toDate(min(ts), {tz:String})) AS cohort FROM events
       WHERE site_id = {site:UUID} AND type != 'revenue' GROUP BY visitor_id HAVING cohort >= toMonday(today()) - {weeks:UInt8} * 7)
     SELECT toString(f.cohort) AS week, intDiv(dateDiff('day', f.cohort, toMonday(toDate(e.ts, {tz:String}))), 7) AS k, uniq(e.visitor_id) AS n
     FROM events e INNER JOIN firsts f ON e.visitor_id = f.visitor_id
     WHERE e.site_id = {site:UUID} AND e.type != 'revenue' AND e.ts >= f.cohort
     GROUP BY week, k ORDER BY week, k`,
    { site: siteId, tz, weeks: weeks - 1 },
  );
  const byWeek = new Map<string, number[]>();
  for (const r of rows) {
    const arr = byWeek.get(r.week) ?? [];
    arr[Number(r.k)] = Number(r.n);
    byWeek.set(r.week, arr);
  }
  return [...byWeek.entries()].map(([week, arr]) => ({ week, size: arr[0] ?? 0, retained: Array.from({ length: arr.length }, (_, i) => arr[i] ?? 0) }));
}
