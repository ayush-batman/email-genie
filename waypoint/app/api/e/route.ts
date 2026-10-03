import { randomBytes, randomUUID } from "node:crypto";
import { browserPayloadSchema } from "@/lib/payload.ts";
import { buildRow, geoFromHeaders, isBot, privateVisitorId, sessionize } from "@/lib/collect.ts";
import { ch, sql, type Site } from "@/lib/db.ts";

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

    // The IP is used in memory only (hash input); it is never stored.
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || req.headers.get("x-real-ip") || "";
    const product = site.mode === "product" && p.vid;
    const visitorId = product ? p.vid! : privateVisitorId(await dailySalt(), site.id, ip, ua);
    const now = new Date();
    const row = buildRow(p, { siteId: site.id, visitorId, ua, geo: geoFromHeaders(req.headers), now, userId: product ? (p.uid ?? "") : "" });
    sessionize(row, `${site.id}:${visitorId}`, now.getTime(), randomUUID);
    // ClickHouse async inserts batch server-side, so no buffering code here.
    await ch.insert({ table: "events", values: [row], format: "JSONEachRow", clickhouse_settings: { async_insert: 1, wait_for_async_insert: 0 } });
  } catch (err) {
    console.error("collect failed", err);
  }
  return ok();
}
