import { randomBytes, randomUUID } from "node:crypto";
import { browserPayloadSchema } from "@/lib/payload.ts";
import { buildRow, geoFromHeaders, isBot, privateVisitorId, sessionize, type EventRow } from "@/lib/collect.ts";
import { ch, sql, type Site } from "@/lib/db.ts";
import { canIngest } from "@/lib/plans.ts";
import { monthEvents } from "@/lib/billing.ts";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };
const ok = () => new Response(null, { status: 202, headers: CORS });

const siteCache = new Map<string, { site: Site | null; at: number }>();
async function siteByPublicId(publicId: string): Promise<Site | null> {
  const hit = siteCache.get(publicId);
  if (hit && Date.now() - hit.at < 60_000) return hit.site;
  const [site] = await sql<Site[]>`SELECT * FROM sites WHERE public_id = ${publicId}`;
  siteCache.set(publicId, { site: site ?? null, at: Date.now() });
  return site ?? null;
}

let saltCache: { day: string; salt: string } | null = null;
async function dailySalt(): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  if (saltCache?.day === day) return saltCache.salt;
  await sql`INSERT INTO daily_salts (day, salt) VALUES (${day}, ${randomBytes(32).toString("hex")}) ON CONFLICT DO NOTHING`;
  await sql`DELETE FROM daily_salts WHERE day < ${day}`;
  const [row] = await sql<{ salt: string }[]>`SELECT salt FROM daily_salts WHERE day = ${day}`;
  saltCache = { day, salt: row!.salt };
  return saltCache.salt;
}

// Plan limits, checked at most every 5 minutes per org. ponytail: per-process cache; usage can overshoot by ~5 minutes of traffic.
const orgAllowed = new Map<string, { ok: boolean; at: number }>();
async function orgCanIngest(orgId: string): Promise<boolean> {
  const hit = orgAllowed.get(orgId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.ok;
  const [o] = await sql<{ plan: string; trial_ends_at: Date; subscription_status: string | null }[]>`SELECT plan, trial_ends_at, subscription_status FROM organizations WHERE id = ${orgId}`;
  const ok = !!o && canIngest(o, (await monthEvents(orgId)).total);
  orgAllowed.set(orgId, { ok, at: Date.now() });
  return ok;
}

// Events are buffered and written in batches (every second or 5,000 rows), so requests return without waiting on ClickHouse.
// ponytail: an in-process buffer loses up to ~1s of events if the process crashes; use a queue (Kafka/Redis) if that matters.
const buffer: EventRow[] = [];
let flushing: Promise<unknown> | null = null;
function flush() {
  if (flushing || !buffer.length) return;
  const rows = buffer.splice(0, buffer.length);
  flushing = ch
    .insert({ table: "events", values: rows, format: "JSONEachRow" })
    .catch((err) => {
      console.error(`collect: insert of ${rows.length} rows failed, retrying next tick`, err);
      if (buffer.length < 100_000) buffer.unshift(...rows);
    })
    .finally(() => { flushing = null; });
}
const g = globalThis as unknown as { __wpFlush?: ReturnType<typeof setInterval> };
g.__wpFlush ??= setInterval(flush, 1000);

const hostAllowed = (host: string, domain: string) => host === domain || host.endsWith("." + domain) || host === "localhost" || host === "127.0.0.1";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  // Never surface errors to the customer's website: always 202.
  try {
    const text = await req.text();
    if (text.length > 16_384) return ok();
    const parsed = browserPayloadSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return ok();
    const p = parsed.data;

    const ua = req.headers.get("user-agent") ?? "";
    if (isBot(ua) || req.headers.get("purpose") === "prefetch" || req.headers.get("sec-purpose")?.includes("prefetch")) return ok();

    const site = await siteByPublicId(p.s);
    if (!site) return ok();
    const host = new URL(p.u).hostname.replace(/^www\./, "");
    if (!hostAllowed(host, site.domain.replace(/^www\./, ""))) return ok();
    if (!(await orgCanIngest(site.org_id))) return ok(); // never break the customer's site: still 202

    // The IP is used in memory only (hash input); it is never stored.
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || req.headers.get("x-real-ip") || "";
    const product = site.mode === "product" && p.vid;
    const visitorId = product ? p.vid! : privateVisitorId(await dailySalt(), site.id, ip, ua);
    const now = new Date();
    const row = buildRow(p, { siteId: site.id, visitorId, ua, geo: geoFromHeaders(req.headers), now, userId: product ? (p.uid ?? "") : "" });
    sessionize(row, `${site.id}:${visitorId}`, now.getTime(), randomUUID);
    buffer.push(row);
    if (buffer.length >= 5000) flush();
  } catch (err) {
    console.error("collect failed", err);
  }
  return ok();
}
