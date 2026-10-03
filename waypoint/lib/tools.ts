// One registry of read-only analytics tools, shared by the REST API (/api/v1) and the MCP server (/api/mcp).
// Each tool wraps the same query functions the dashboard uses, so every surface returns identical numbers.
import { createHash } from "node:crypto";
import { z } from "zod";
import { sql, type Site } from "./db.ts";
import { resolvePeriod, previousRange } from "./dates.ts";
import { decodeFilters, DIMENSION_KEYS, PERIODS, type Dimension, type Period } from "./query.ts";
import { breakdown, goalStats, kpis, liveFeed, onlineNow, timeseries, type Goal, type Scope } from "./stats.ts";
import { revenueBy, revenueSummary, recentPayments } from "./revenue.ts";
import { runFunnel, type Funnel } from "./funnels.ts";
import { listVisitors, visitorProfile } from "./visitors.ts";

export type ApiContext = { orgId: string };

/** Resolves "Bearer wp_live_..." to an org; null if missing/revoked. */
export async function authenticate(req: Request): Promise<ApiContext | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("wp_live_")) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const [k] = await sql<{ id: string; org_id: string }[]>`SELECT id, org_id FROM api_keys WHERE key_hash = ${hash} AND revoked_at IS NULL`;
  if (!k) return null;
  await sql`UPDATE api_keys SET last_used_at = now() WHERE id = ${k.id} AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute')`;
  return { orgId: k.org_id };
}

export class ToolError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function siteFor(ctx: ApiContext, idOrPublicId: string): Promise<Site> {
  const [s] = await sql<Site[]>`SELECT * FROM sites WHERE org_id = ${ctx.orgId} AND (public_id = ${idOrPublicId} OR id::text = ${idOrPublicId})`;
  if (!s) throw new ToolError(404, `Site not found: ${idOrPublicId}. Call list_sites to see available sites.`);
  return s;
}

// ---- shared input pieces ----
const site_id = z.string().describe("Site id or public id (from list_sites)");
const period = z.enum(PERIODS.filter((p) => p !== "custom") as [Exclude<Period, "custom">, ...Exclude<Period, "custom">[]]).default("30d")
  .describe("Date range preset, in the site's timezone. Use from/to for a custom range.");
const from = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Custom range start, YYYY-MM-DD (inclusive). Requires `to`.");
const to = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Custom range end, YYYY-MM-DD (inclusive).");
const filters = z.string().optional().describe("Filters as dim:op:value joined by |, e.g. channel:is:Organic Search|page:contains:/blog. ops: is, is_not, contains, not_contains");
const dimension = z.enum(DIMENSION_KEYS as [Dimension, ...Dimension[]]);
const range = { site_id, period, from, to, filters };

async function scopeFor(ctx: ApiContext, a: { site_id: string; period: Period; from?: string; to?: string; filters?: string }): Promise<{ site: Site; scope: Scope; label: string }> {
  const site = await siteFor(ctx, a.site_id);
  const p: Period = a.from && a.to ? "custom" : a.period;
  const r = resolvePeriod(p, site.timezone, { from: a.from, to: a.to });
  return {
    site,
    scope: { siteId: site.id, tz: site.timezone, range: r, filters: decodeFilters(a.filters), currency: site.currency },
    label: `${r.from.toISOString()} to ${r.to.toISOString()} (${p}, ${site.timezone})`,
  };
}

type Tool<S extends z.ZodObject> = { name: string; description: string; input: S; path: string; run: (ctx: ApiContext, input: z.infer<S>) => Promise<unknown> };
const tool = <S extends z.ZodObject>(t: Tool<S>) => t;

export const TOOLS = [
  tool({
    name: "list_sites", path: "/sites",
    description: "List the websites this key can access, with their ids, domains, timezones and revenue currency.",
    input: z.object({}),
    run: async (ctx) => {
      const rows = await sql<Site[]>`SELECT * FROM sites WHERE org_id = ${ctx.orgId} ORDER BY created_at`;
      return { sites: rows.map((s) => ({ id: s.id, public_id: s.public_id, name: s.name, domain: s.domain, timezone: s.timezone, currency: s.currency, mode: s.mode })) };
    },
  }),
  tool({
    name: "get_overview", path: "/sites/{site_id}/stats",
    description: "Headline metrics for a period (visitors, visits, pageviews, views per visit, bounce rate, visit duration in seconds, custom events, verified revenue in minor units) plus the previous period of equal length for comparison.",
    input: z.object({ ...range }),
    run: async (ctx, a) => {
      const { site, scope, label } = await scopeFor(ctx, a);
      const [cur, prev] = await Promise.all([kpis(scope), kpis({ ...scope, range: previousRange(scope.range) })]);
      return { site: site.domain, range: label, currency: site.currency, current: cur, previous: prev };
    },
  }),
  tool({
    name: "get_timeseries", path: "/sites/{site_id}/timeseries",
    description: "Metrics bucketed over time (minute/hour/day/week/month chosen automatically from the range).",
    input: z.object({ ...range }),
    run: async (ctx, a) => {
      const { site, scope, label } = await scopeFor(ctx, a);
      return { site: site.domain, range: label, interval: scope.range.interval, points: await timeseries(scope) };
    },
  }),
  tool({
    name: "get_breakdown", path: "/sites/{site_id}/breakdown",
    description: "Top values of one dimension (e.g. channel, referrer, utm_campaign, page, entry_page, country, device, event) with visitors, count (visits, pageviews or events), share of visitors and verified revenue (minor units).",
    input: z.object({ ...range, dimension, limit: z.coerce.number().int().min(1).max(100).default(10) }),
    run: async (ctx, a) => {
      const { site, scope, label } = await scopeFor(ctx, a);
      return { site: site.domain, range: label, dimension: a.dimension, currency: site.currency, rows: await breakdown(scope, a.dimension, a.limit) };
    },
  }),
  tool({
    name: "get_realtime", path: "/sites/{site_id}/realtime",
    description: "Visitors online in the last 5 minutes and the 20 most recent pageviews/events.",
    input: z.object({ site_id }),
    run: async (ctx, a) => {
      const site = await siteFor(ctx, a.site_id);
      const [online, recent] = await Promise.all([onlineNow(site.id), liveFeed(site.id, undefined, 20)]);
      return { site: site.domain, online, recent: recent.map(({ visitor_id: _v, props: _p, ...e }) => e) };
    },
  }),
  tool({
    name: "get_revenue", path: "/sites/{site_id}/revenue",
    description: "Verified revenue for a period: totals (net, new, renewals, refunds, customers, conversion rate, revenue per visitor, average order value, time and visits to convert) and revenue by a dimension with first- or last-touch attribution. Amounts are in minor units of the site currency.",
    input: z.object({ ...range, attribution: z.enum(["first_touch", "last_touch"]).default("last_touch"), breakdown: z.enum(["channel", "referrer", "utm_source", "utm_medium", "utm_campaign", "country", "device", "page"]).default("channel") }),
    run: async (ctx, a) => {
      const { site, scope, label } = await scopeFor(ctx, a);
      const [summary, by, recent] = await Promise.all([revenueSummary(scope), revenueBy(scope, a.breakdown, a.attribution, 15), recentPayments(scope, 10)]);
      return { site: site.domain, range: label, currency: site.currency, summary, attribution: a.attribution, by: a.breakdown, rows: by, recent_payments: recent.map(({ visitor_id: _v, ...p }) => p) };
    },
  }),
  tool({
    name: "list_funnels", path: "/sites/{site_id}/funnels",
    description: "Saved funnels for a site with their steps.",
    input: z.object({ site_id }),
    run: async (ctx, a) => {
      const site = await siteFor(ctx, a.site_id);
      return { funnels: await sql<Funnel[]>`SELECT id, name, steps, window_hours FROM funnels WHERE site_id = ${site.id} ORDER BY created_at` };
    },
  }),
  tool({
    name: "run_funnel", path: "/sites/{site_id}/funnels/{funnel_id}",
    description: "Conversion through a saved funnel (funnel_id) or ad-hoc steps: visitors at each step, % of first step, % of previous step, drop-off and median seconds between steps.",
    input: z.object({
      ...range,
      funnel_id: z.string().optional(),
      steps: z.array(z.object({ kind: z.enum(["pageview", "event"]), match: z.string().min(1) })).min(2).max(10).optional().describe("Ad-hoc steps when no funnel_id; page paths start with / and may end with *"),
      window_hours: z.coerce.number().int().min(1).max(2160).default(24),
    }),
    run: async (ctx, a) => {
      const { site, scope, label } = await scopeFor(ctx, a);
      let f: Funnel | undefined;
      if (a.funnel_id) [f] = await sql<Funnel[]>`SELECT id, name, steps, window_hours FROM funnels WHERE id::text = ${a.funnel_id} AND site_id = ${site.id}`;
      else if (a.steps) f = { id: "adhoc", name: "Ad-hoc funnel", steps: a.steps, window_hours: a.window_hours };
      if (!f) throw new ToolError(400, "Pass a funnel_id from list_funnels, or at least two steps.");
      return { site: site.domain, range: label, funnel: f.name, window_hours: f.window_hours, steps: await runFunnel(scope, f) };
    },
  }),
  tool({
    name: "get_goals", path: "/sites/{site_id}/goals",
    description: "Goal completions and conversion rates (visitors who completed ÷ all visitors) for a period.",
    input: z.object({ ...range }),
    run: async (ctx, a) => {
      const { site, scope, label } = await scopeFor(ctx, a);
      const goals = await sql<Goal[]>`SELECT id, name, kind, match FROM goals WHERE site_id = ${site.id} ORDER BY created_at`;
      return { site: site.domain, range: label, goals: await goalStats(scope, goals) };
    },
  }),
  tool({
    name: "find_visitors", path: "/sites/{site_id}/visitors",
    description: "Visitors active in a period, newest first, with first-touch source, location, device, visits, pageviews and revenue. Optional search by identified user id.",
    input: z.object({ ...range, search: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(20) }),
    run: async (ctx, a) => {
      const { site, scope, label } = await scopeFor(ctx, a);
      return { site: site.domain, range: label, visitors: await listVisitors(scope, { search: a.search, limit: a.limit }) };
    },
  }),
  tool({
    name: "get_visitor", path: "/sites/{site_id}/visitors/{visitor_id}",
    description: "One visitor's profile: identity, first and last touch, totals and each visit's pages and events (most recent 20 visits).",
    input: z.object({ site_id, visitor_id: z.string().min(1) }),
    run: async (ctx, a) => {
      const site = await siteFor(ctx, a.site_id);
      const p = await visitorProfile(site.id, a.visitor_id);
      if (!p) throw new ToolError(404, "Visitor not found");
      return {
        user_id: p.userId, first_seen: p.first.time, last_seen: p.last.time, pageviews: p.pageviews, revenue: p.revenue,
        first_touch: { channel: p.first.channel, referrer: p.first.referrer_domain, campaign: p.first.utm_campaign, landing_page: p.first.url_path },
        visits: p.sessions.slice(0, 20).map((s) => ({ start: s.start, events: s.events.filter((e) => e.type !== "ping").map((e) => ({ time: e.time, type: e.type, name: e.name, page: e.url_path, props: e.props, revenue: e.revenue_minor || undefined })) })),
      };
    },
  }),
];

export type AnyTool = (typeof TOOLS)[number];

export async function runTool(t: AnyTool, ctx: ApiContext, raw: unknown) {
  const parsed = t.input.safeParse(raw ?? {});
  if (!parsed.success) throw new ToolError(400, parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
  return (t.run as (c: ApiContext, i: unknown) => Promise<unknown>)(ctx, parsed.data);
}
