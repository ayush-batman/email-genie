// Performance check: generates N synthetic events for a throwaway site inside ClickHouse, then times dashboard queries.
// Usage: npm run bench -- 10000000
import { randomUUID } from "node:crypto";
import { ch } from "../lib/db.ts";
import { resolvePeriod } from "../lib/dates.ts";
import { breakdown, kpis, timeseries } from "../lib/stats.ts";
import { runFunnel } from "../lib/funnels.ts";
import { revenueBy } from "../lib/revenue.ts";

const N = Number(process.argv[2] ?? 10_000_000);
const site = randomUUID();
const t0 = Date.now();
await ch.command({
  query: `INSERT INTO events (site_id, ts, type, name, visitor_id, session_id, hostname, url_path, channel, referrer_domain, country, device, browser, os, revenue_minor, revenue_currency)
    SELECT {site:UUID}, now64(3) - toIntervalSecond(rand() % (90 * 86400)),
      multiIf(number % 50 = 0, 'event', number % 997 = 0, 'revenue', 'pageview'), multiIf(number % 50 = 0, 'signup', number % 997 = 0, 'payment', 'pageview'),
      toString(intDiv(number, 7) % ({n:UInt64} / 9)), toString(intDiv(number, 3)), 'bench.dev',
      arrayElement(['/', '/pricing', '/signup', '/docs', '/blog/a', '/blog/b', '/features'], (number % 7) + 1),
      arrayElement(['Direct', 'Organic Search', 'Organic Social', 'Referral', 'AI Assistants', 'Email'], (intDiv(number, 3) % 6) + 1),
      arrayElement(['', 'google.com', 'x.com', 'github.com', 'chatgpt.com', ''], (intDiv(number, 3) % 6) + 1),
      arrayElement(['US', 'DE', 'IN', 'GB', 'FR', 'BR', 'JP'], (number % 7) + 1), if(number % 3 = 0, 'mobile', 'desktop'), 'Chrome', 'macOS',
      if(number % 997 = 0, 2900, 0), if(number % 997 = 0, 'USD', '')
    FROM numbers({n:UInt64})`,
  query_params: { site, n: N },
  clickhouse_settings: { max_insert_threads: "4" },
});
console.log(`inserted ${N.toLocaleString()} events in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const scope = { siteId: site, tz: "UTC", range: resolvePeriod("30d", "UTC"), filters: [], currency: "USD" };
const time = async (label: string, fn: () => Promise<unknown>) => {
  const s = performance.now();
  await fn();
  console.log(`${label.padEnd(34)} ${(performance.now() - s).toFixed(0).padStart(6)} ms`);
};
await time("kpis (30d)", () => kpis(scope));
await time("timeseries (30d, daily)", () => timeseries(scope));
await time("breakdown channel", () => breakdown(scope, "channel", 10));
await time("breakdown entry_page", () => breakdown(scope, "entry_page", 10));
await time("kpis + filter (channel)", () => kpis({ ...scope, filters: [{ dim: "channel", op: "is", value: "Organic Search" }] }));
await time("full overview (parallel)", () => Promise.all([kpis(scope), timeseries(scope), ...(["channel", "page", "country", "device", "event"] as const).map((d) => breakdown(scope, d, 9))]));
await time("funnel (3 steps)", () => runFunnel(scope, { id: "b", name: "b", window_hours: 24, steps: [{ kind: "pageview", match: "/" }, { kind: "pageview", match: "/pricing" }, { kind: "event", match: "signup" }] }));
await time("revenue first-touch by channel", () => revenueBy(scope, "channel", "first_touch"));
if (!process.argv.includes("--keep")) await ch.command({ query: "DELETE FROM events WHERE site_id = {site:UUID}", query_params: { site } });
else console.log("kept bench site", site);
await ch.close();
