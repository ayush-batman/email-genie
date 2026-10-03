// Turns a validated tracker payload + request metadata into an `events` row. Pure, so it's testable.
import { createHash } from "node:crypto";
import { classifyChannel, referrerDomain } from "./channels.ts";
import type { BrowserPayload } from "./payload.ts";
import { getOrSet, redis } from "./redis.ts";

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|curl|wget|python|httpclient|axios|go-http|java\/|phantom|puppeteer|playwright|selenium/i;

export function isBot(ua: string): boolean {
  return !ua || BOT_RE.test(ua);
}

// ponytail: regex UA parsing covers the major browsers/OSes; swap in ua-parser-js if the long tail matters.
export function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\/|FxiOS/.test(ua) ? "Firefox"
    : /Chrome\/|CriOS/.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "Other";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux"
    : "Other";
  const device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet" : /Mobi|iPhone|Android/.test(ua) ? "mobile" : "desktop";
  return { browser, os, device };
}

export function screenBucket(w?: number): string {
  if (!w) return "";
  return w < 576 ? "XS" : w < 768 ? "S" : w < 992 ? "M" : w < 1440 ? "L" : "XL";
}

const CLICK_IDS = ["gclid", "fbclid", "msclkid", "ttclid", "li_fat_id"] as const;

export type Geo = { country: string; region: string; city: string };

/** Geo from CDN headers (Cloudflare / Vercel). ponytail: no MaxMind; add GeoLite2 when self-hosting without a CDN. */
export function geoFromHeaders(h: Headers): Geo {
  const dec = (v: string | null) => (v ? decodeURIComponent(v) : "");
  const country = (h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country") ?? "").toUpperCase();
  return {
    country: country === "XX" || country === "T1" ? "" : country,
    region: dec(h.get("cf-region") ?? h.get("x-vercel-ip-country-region")),
    city: dec(h.get("cf-ipcity") ?? h.get("x-vercel-ip-city")),
  };
}

export function privateVisitorId(salt: string, siteId: string, ip: string, ua: string): string {
  return createHash("sha256").update(`${salt}|${siteId}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

export type EventRow = {
  site_id: string;
  ts: string;
  type: string;
  name: string;
  visitor_id: string;
  session_id: string;
  user_id: string;
  hostname: string;
  url_path: string;
  title: string;
  referrer_domain: string;
  channel: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  country: string;
  region: string;
  city: string;
  browser: string;
  os: string;
  device: string;
  screen_bucket: string;
  language: string;
  engaged_ms: number;
  props: Record<string, string>;
  revenue_minor: number;
  revenue_currency: string;
};

export function buildRow(
  p: BrowserPayload,
  ctx: { siteId: string; visitorId: string; ua: string; geo: Geo; now: Date; userId?: string },
): EventRow {
  const url = new URL(p.u);
  const q = url.searchParams;
  const ref = referrerDomain(p.r ?? "", url.hostname);
  const utm = (k: string) => (q.get(`utm_${k}`) ?? "").slice(0, 256);
  // Common non-UTM source params (?ref=, ?source=, ?via=) count as utm_source.
  const utmSource = utm("source") || (q.get("ref") ?? q.get("source") ?? q.get("via") ?? "").slice(0, 256);
  const clickIdType = CLICK_IDS.find((k) => q.has(k)) ?? "";
  const { browser, os, device } = parseUserAgent(ctx.ua);
  const props: Record<string, string> = {};
  for (const [k, v] of Object.entries(p.p ?? {})) props[k] = String(v);

  return {
    site_id: ctx.siteId,
    ts: ctx.now.toISOString(),
    type: p.t,
    name: p.t === "event" ? (p.n ?? "event") : p.t,
    visitor_id: ctx.visitorId,
    session_id: "",
    user_id: ctx.userId ?? "",
    hostname: url.hostname,
    url_path: decodeURIComponent(url.pathname).slice(0, 1024) || "/",
    title: p.ti ?? "",
    referrer_domain: ref,
    channel: classifyChannel({ referrerDomain: ref, utmSource, utmMedium: utm("medium"), clickIdType }),
    utm_source: utmSource,
    utm_medium: utm("medium"),
    utm_campaign: utm("campaign"),
    utm_term: utm("term"),
    utm_content: utm("content"),
    ...ctx.geo,
    browser,
    os,
    device,
    screen_bucket: screenBucket(p.w),
    language: (p.l ?? "").slice(0, 35),
    engaged_ms: p.et ?? 0,
    props,
    revenue_minor: p.rev?.a ?? 0,
    revenue_currency: p.rev?.c.toUpperCase() ?? "",
  };
}

/**
 * Sessionization: a visit ends after 30 min of inactivity. The first event's source fields
 * (referrer, channel, UTMs) are pinned to the whole session, so internal navigation stays attributed.
 * In-process version for a single instance; assignSession() below uses Redis when REDIS_URL is set.
 */
const SESSION_GAP_MS = 30 * 60_000;
export const SOURCE_FIELDS = ["referrer_domain", "channel", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
type Source = Pick<EventRow, (typeof SOURCE_FIELDS)[number]>;
const sessions = new Map<string, { id: string; last: number; source: Source }>();

/** Assigns `row` to the visitor's current session (or starts one) and applies the session's pinned source. */
export function sessionize(row: EventRow, key: string, now: number, newId: () => string): void {
  let s = sessions.get(key);
  if (!s || now - s.last >= SESSION_GAP_MS) {
    const source = Object.fromEntries(SOURCE_FIELDS.map((f) => [f, row[f]])) as Source;
    s = { id: newId(), last: now, source };
    sessions.set(key, s);
    if (sessions.size > 200_000) for (const [k, v] of sessions) if (now - v.last >= SESSION_GAP_MS) sessions.delete(k);
  }
  s.last = now;
  row.session_id = s.id;
  Object.assign(row, s.source);
}

/** Sessionize through Redis when available (shared by all instances), else in process. */
export async function assignSession(row: EventRow, key: string, now: number, newId: () => string): Promise<void> {
  const r = redis();
  if (!r) return sessionize(row, key, now, newId);
  const fresh = JSON.stringify({ id: newId(), source: Object.fromEntries(SOURCE_FIELDS.map((f) => [f, row[f]])) });
  const s = JSON.parse(await getOrSet(r, `wp:sess:${key}`, fresh, SESSION_GAP_MS)) as { id: string; source: Source };
  row.session_id = s.id;
  Object.assign(row, s.source);
}
