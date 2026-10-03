// Seeds a demo account (demo@waypoint.dev / demo1234) with ~90 days of realistic traffic.
// Deterministic RNG so the demo looks the same on every machine. Re-running replaces the demo site's events.
import { randomUUID } from "node:crypto";
import { buildRow, SOURCE_FIELDS, type EventRow } from "../lib/collect.ts";
import { hashPassword } from "../lib/password.ts";
import { ch, sql } from "../lib/db.ts";


let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(xs: [T, number][]): T => {
  const total = xs.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [x, w] of xs) if ((r -= w) <= 0) return x;
  return xs[0]![0];
};

const DOMAIN = "acme-demo.com";
const SOURCES: [{ ref?: string; q?: string }, number][] = [
  [{}, 30],
  [{ ref: "https://www.google.com/" }, 28],
  [{ ref: "https://www.bing.com/" }, 3],
  [{ ref: "https://duckduckgo.com/" }, 3],
  [{ ref: "https://chatgpt.com/" }, 6],
  [{ ref: "https://www.perplexity.ai/" }, 2],
  [{ ref: "https://claude.ai/" }, 2],
  [{ ref: "https://news.ycombinator.com/" }, 4],
  [{ ref: "https://www.reddit.com/r/SaaS/" }, 4],
  [{ ref: "https://t.co/abc" }, 4],
  [{ ref: "https://www.linkedin.com/" }, 3],
  [{ ref: "https://www.producthunt.com/" }, 2],
  [{ ref: "https://github.com/acme/sdk" }, 3],
  [{ ref: "https://dev.to/someone/post" }, 2],
  [{ q: "utm_source=google&utm_medium=cpc&utm_campaign=brand&gclid=x" }, 5],
  [{ q: "utm_source=newsletter&utm_medium=email&utm_campaign=october-launch" }, 3],
  [{ q: "utm_source=twitter&utm_medium=paid_social&utm_campaign=launch-week" }, 2],
  [{ q: "ref=partnerblog" }, 1],
];
const LANDING: [string, number][] = [["/", 50], ["/pricing", 12], ["/blog/privacy-first-analytics", 10], ["/blog/funnels-101", 7], ["/features", 8], ["/docs", 8], ["/changelog", 3], ["/compare/google-analytics", 5]];
const NEXT: Record<string, [string, number][]> = {
  "/": [["/pricing", 30], ["/features", 25], ["/docs", 10], ["/signup", 12], ["/blog/funnels-101", 5]],
  "/pricing": [["/signup", 35], ["/features", 10], ["/", 10]],
  "/features": [["/pricing", 40], ["/signup", 10], ["/docs", 10]],
  "/docs": [["/docs/install", 50], ["/docs/api", 20], ["/pricing", 10]],
  "/signup": [["/onboarding", 60]],
  "/onboarding": [["/dashboard", 70]],
};
const TITLES: Record<string, string> = { "/": "Acme — Analytics for founders", "/pricing": "Pricing — Acme", "/features": "Features — Acme", "/signup": "Sign up — Acme", "/docs": "Docs — Acme" };
const GEO: [{ country: string; region: string; city: string }, number][] = [
  [{ country: "US", region: "CA", city: "San Francisco" }, 14], [{ country: "US", region: "NY", city: "New York" }, 10],
  [{ country: "US", region: "TX", city: "Austin" }, 5], [{ country: "GB", region: "ENG", city: "London" }, 9],
  [{ country: "DE", region: "BE", city: "Berlin" }, 8], [{ country: "IN", region: "KA", city: "Bengaluru" }, 9],
  [{ country: "IN", region: "MH", city: "Mumbai" }, 5], [{ country: "FR", region: "IDF", city: "Paris" }, 5],
  [{ country: "CA", region: "ON", city: "Toronto" }, 5], [{ country: "NL", region: "NH", city: "Amsterdam" }, 4],
  [{ country: "BR", region: "SP", city: "São Paulo" }, 4], [{ country: "AU", region: "NSW", city: "Sydney" }, 3],
  [{ country: "JP", region: "13", city: "Tokyo" }, 3], [{ country: "ES", region: "MD", city: "Madrid" }, 3],
  [{ country: "SG", region: "", city: "Singapore" }, 2], [{ country: "SE", region: "AB", city: "Stockholm" }, 2],
];
const UAS: [string, number][] = [
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36", 30],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36", 22],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", 18],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", 9],
  ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36", 9],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0", 6],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Edg/128.0", 4],
  ["Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", 2],
];
const WIDTHS: Record<string, number> = { desktop: 1512, mobile: 390, tablet: 820 };

// --- account, org, site ---
const email = "demo@waypoint.dev";
await sql`DELETE FROM users WHERE email = ${email}`;
await sql`DELETE FROM organizations WHERE name = 'Acme (demo)'`;
const [user] = await sql<{ id: string }[]>`INSERT INTO users (email, name, password_hash) VALUES (${email}, 'Demo User', ${await hashPassword("demo1234")}) RETURNING id`;
const [org] = await sql<{ id: string }[]>`INSERT INTO organizations (name) VALUES ('Acme (demo)') RETURNING id`;
await sql`INSERT INTO memberships (org_id, user_id, role) VALUES (${org!.id}, ${user!.id}, 'owner')`;
const [site] = await sql<{ id: string }[]>`
  INSERT INTO sites (org_id, public_id, name, domain, mode, timezone, share_token)
  VALUES (${org!.id}, 'demo', 'Acme', ${DOMAIN}, 'product', 'America/New_York', 'demo') RETURNING id`;
await ch.command({ query: `ALTER TABLE events DELETE WHERE site_id = '${site!.id}'`, clickhouse_settings: { mutations_sync: "2" } });

// --- traffic ---
const DAYS = 90;
const rows: EventRow[] = [];
const returning: { vid: string; ua: string; geo: (typeof GEO)[number][0] }[] = [];
const now = Date.now();
let source: Partial<EventRow> = {};

for (let d = DAYS; d >= 0; d--) {
  const dayStart = now - d * 86_400_000;
  const weekday = new Date(dayStart).getUTCDay();
  const growth = 1 + (DAYS - d) / DAYS; // traffic doubles over the period
  const spike = d === 40 ? 4 : d === 39 ? 2 : 1; // a Hacker News launch day
  const sessionsToday = Math.round((weekday === 0 || weekday === 6 ? 70 : 110) * growth * spike * (0.85 + rand() * 0.3));

  for (let i = 0; i < sessionsToday; i++) {
    let t = d === 0 ? now - rand() * 6 * 3600_000 : dayStart - rand() * 86_400_000;
    const back = returning.length > 50 && rand() < 0.25 ? returning[Math.floor(rand() * returning.length)]! : null;
    const vid = back?.vid ?? randomUUID();
    const ua = back?.ua ?? pick(UAS);
    const geo = back?.geo ?? pick(GEO);
    if (!back) returning.push({ vid, ua, geo });
    const src = d === 40 && rand() < 0.6 ? { ref: "https://news.ycombinator.com/" } : pick(SOURCES);
    const sid = randomUUID();
    let path = pick(LANDING);
    const device = /iPad/.test(ua) ? "tablet" : /Mobile/.test(ua) ? "mobile" : "desktop";
    const base = { s: "demo", w: WIDTHS[device], l: pick([["en-US", 6], ["en-GB", 2], ["de-DE", 1], ["fr-FR", 1]] as [string, number][]) };
    let first = true;
    let identified = "";

    for (let step = 0; step < 8; step++) {
      const url = `https://${DOMAIN}${path}${first && src.q ? `?${src.q}` : ""}`;
      const push = (p: Parameters<typeof buildRow>[0]) => {
        const r = buildRow(p, { siteId: site!.id, visitorId: vid, ua, geo, now: new Date(t), userId: identified });
        rows.push(r);
        return r;
      };
      const pv = push({ ...base, t: "pageview", u: url, r: first ? (src.ref ?? "") : "", ti: TITLES[path] ?? "Acme" });
      if (first) source = Object.fromEntries(SOURCE_FIELDS.map((f) => [f, pv[f]]));
      const dwell = 5_000 + rand() * 90_000;
      t += dwell;
      push({ ...base, t: "ping", u: url, r: "", ti: "", et: Math.round(dwell * 0.8) });

      if (path === "/pricing" && rand() < 0.3) push({ ...base, t: "event", n: "cta_click", u: url, r: "", ti: "", p: { location: pick([["hero", 3], ["plan_card", 5], ["footer", 1]]), plan: pick([["starter", 2], ["growth", 3], ["business", 1]]) } });
      if (path === "/docs/install" && rand() < 0.4) push({ ...base, t: "event", n: "copy_snippet", u: url, r: "", ti: "", p: { framework: pick([["nextjs", 4], ["html", 3], ["react", 2], ["wordpress", 1]]) } });
      if (path === "/signup" && rand() < 0.55) {
        identified = `user_${vid.slice(0, 8)}`;
        push({ ...base, t: "event", n: "signup", u: url, r: "", ti: "", p: { method: pick([["google", 3], ["email", 2], ["github", 2]]) } });
      }
      if (path === "/dashboard" && rand() < 0.18) {
        const plan = pick([["starter", 5], ["growth", 3], ["business", 1]] as [string, number][]);
        const amount = { starter: 900, growth: 2900, business: 9900 }[plan]!;
        push({ ...base, t: "event", n: "purchase", u: url, r: "", ti: "", p: { plan }, rev: { a: amount, c: "USD" } });
      }
      if (rand() < 0.04) push({ ...base, t: "event", n: "outbound_click", u: url, r: "", ti: "", p: { url: "https://github.com/acme/sdk" } });

      const options = NEXT[path];
      if (!options || rand() < (step === 0 ? 0.42 : 0.35)) break;
      path = pick(options);
      first = false;
    }
    // Pin session source + id like the collector does.
    for (let k = rows.length - 1; k >= 0 && rows[k]!.visitor_id === vid && !rows[k]!.session_id; k--) {
      Object.assign(rows[k]!, source, { session_id: sid });
    }
  }
}

for (let i = 0; i < rows.length; i += 50_000) {
  await ch.insert({ table: "events", values: rows.slice(i, i + 50_000), format: "JSONEachRow" });
}
console.log(`seeded ${rows.length} events for ${email} / demo1234 (site ${site!.id})`);
await sql.end();
await ch.close();
