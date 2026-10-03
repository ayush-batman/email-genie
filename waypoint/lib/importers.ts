// Maps other tools' exports onto Waypoint's events table. Pure functions over parsed rows; see lib/import-job.ts for I/O.
import { classifyChannel, referrerDomain } from "./channels.ts";
import type { EventRow } from "./collect.ts";

export const IMPORT_PROVIDERS = {
  umami: { name: "Umami", files: "website_event.csv (required), session.csv and event_data.csv (optional)", help: "Umami Cloud → Settings → Data → Export, or export the website_event / session / event_data tables from a self-hosted database." },
  databuddy: { name: "Databuddy", files: "events.csv from the export zip", help: "Databuddy → Website settings → Export data (CSV). Unzip and upload events.csv." },
  vercel: { name: "Vercel Analytics", files: "Web Analytics Drain files (.ndjson or .json)", help: "Vercel → Team settings → Drains → Web Analytics (JSON or NDJSON). Upload the files your drain endpoint stored." },
} as const;
export type ImportProvider = keyof typeof IMPORT_PROVIDERS;

type Base = Omit<EventRow, "site_id">;
const EMPTY: Base = {
  ts: "", type: "pageview", name: "pageview", visitor_id: "", session_id: "", user_id: "", hostname: "", url_path: "/", title: "",
  referrer_domain: "", channel: "Direct", utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "",
  country: "", region: "", city: "", browser: "", os: "", device: "", screen_bucket: "", language: "", engaged_ms: 0, props: {},
  revenue_minor: 0, revenue_currency: "",
};

const CLICK_IDS = ["gclid", "fbclid", "msclkid", "ttclid", "li_fat_id"];

/** UTM + channel fields from a query string and referrer. */
function source(query: string, referrer: string, host: string, utm: Partial<Record<"source" | "medium" | "campaign" | "term" | "content", string>> = {}) {
  const q = new URLSearchParams(query.replace(/^\?/, ""));
  const get = (k: "source" | "medium" | "campaign" | "term" | "content") => (utm[k] || q.get(`utm_${k}`) || "").slice(0, 256);
  const ref = referrer.includes("://") ? referrerDomain(referrer, host) : referrer.replace(/^www\./, "").toLowerCase() === host.replace(/^www\./, "") ? "" : referrer.replace(/^www\./, "").toLowerCase();
  const utmSource = get("source") || q.get("ref") || "";
  return {
    referrer_domain: ref,
    channel: classifyChannel({ referrerDomain: ref, utmSource, utmMedium: get("medium"), clickIdType: CLICK_IDS.find((k) => q.has(k)) ?? "" }),
    utm_source: utmSource, utm_medium: get("medium"), utm_campaign: get("campaign"), utm_term: get("term"), utm_content: get("content"),
  };
}

const device = (d: string) => (/mobile|phone/i.test(d) ? "mobile" : /tablet|ipad/i.test(d) ? "tablet" : d ? "desktop" : "");
const iso = (t: string | number) => {
  const d = typeof t === "number" ? new Date(t) : new Date(/^\d{4}-\d{2}-\d{2} /.test(t) ? t.replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? "" : "Z") : t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Umami: website_event rows (+ optional session and event_data rows). event_type 1 = pageview, 2 = custom event. */
export function mapUmami(events: Record<string, string>[], sessions: Record<string, string>[] = [], eventData: Record<string, string>[] = []): Base[] {
  const bySession = new Map(sessions.map((s) => [s.session_id, s]));
  const props = new Map<string, Record<string, string>>();
  for (const d of eventData) {
    const p = props.get(d.website_event_id ?? "") ?? {};
    p[d.data_key ?? d.event_key ?? "value"] = d.string_value || d.number_value || d.date_value || "";
    props.set(d.website_event_id ?? "", p);
  }
  const out: Base[] = [];
  for (const e of events) {
    const ts = iso(e.created_at ?? "");
    if (!ts || !e.session_id) continue;
    const s = bySession.get(e.session_id) ?? e; // newer exports inline session fields on each event
    const host = e.hostname || s.hostname || "";
    const isEvent = e.event_type === "2";
    out.push({
      ...EMPTY,
      ts,
      type: isEvent ? "event" : "pageview",
      name: isEvent ? (e.event_name || "event").slice(0, 64) : "pageview",
      visitor_id: `umami:${e.session_id}`,
      session_id: `umami:${e.visit_id || e.session_id}`,
      hostname: host,
      url_path: e.url_path || "/",
      title: e.page_title ?? "",
      ...source(e.url_query ?? "", e.referrer_domain ?? "", host, { source: e.utm_source, medium: e.utm_medium, campaign: e.utm_campaign, term: e.utm_term, content: e.utm_content }),
      country: (s.country ?? "").toUpperCase().slice(0, 2),
      region: s.subdivision1 ?? s.region ?? "",
      city: s.city ?? "",
      browser: s.browser ?? "",
      os: s.os ?? "",
      device: device(s.device ?? ""),
      language: s.language ?? "",
      props: props.get(e.event_id ?? "") ?? {},
    });
  }
  return out;
}

/** Databuddy: events.csv. screen_view = pageview, page_exit carries time_on_page (seconds), anything else is a custom event. */
export function mapDatabuddy(events: Record<string, string>[]): Base[] {
  const out: Base[] = [];
  for (const e of events) {
    const ts = iso(e.time ?? "");
    if (!ts || !e.anonymous_id) continue;
    const name = e.event_name ?? "";
    const url = (() => { try { return new URL(e.url ?? ""); } catch { return null; } })();
    const host = url?.hostname ?? "";
    let props: Record<string, string> = {};
    try { props = Object.fromEntries(Object.entries(JSON.parse(e.properties || "{}")).map(([k, v]) => [k, String(v)])); } catch {}
    out.push({
      ...EMPTY,
      ts,
      type: name === "screen_view" || name === "pageview" ? "pageview" : name === "page_exit" ? "ping" : "event",
      name: name === "screen_view" || name === "pageview" ? "pageview" : name === "page_exit" ? "ping" : name.slice(0, 64),
      visitor_id: `databuddy:${e.anonymous_id}`,
      session_id: `databuddy:${e.session_id || e.anonymous_id}`,
      user_id: e.profile_id ?? "",
      hostname: host,
      url_path: e.path || url?.pathname || "/",
      title: e.title ?? "",
      ...source(url?.search ?? "", e.referrer ?? "", host, { source: e.utm_source, medium: e.utm_medium, campaign: e.utm_campaign, term: e.utm_term, content: e.utm_content }),
      country: (e.country ?? "").toUpperCase().slice(0, 2),
      region: e.region ?? "",
      city: e.city ?? "",
      browser: e.browser_name ?? "",
      os: e.os_name ?? "",
      device: device(e.device_type ?? ""),
      language: e.language ?? "",
      engaged_ms: name === "page_exit" ? Math.round(Number(e.time_on_page || 0) * 1000) : 0,
      props: name === "page_exit" ? {} : props,
    });
  }
  return out;
}

/** Vercel Web Analytics drain events (JSON array or NDJSON). Sessions = 30 min of inactivity per deviceId. */
export function mapVercel(text: string): Base[] {
  const trimmed = text.trim();
  const raw: Record<string, unknown>[] = trimmed.startsWith("[") ? JSON.parse(trimmed) : trimmed.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  raw.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  const last = new Map<string, { id: string; at: number }>();
  const out: Base[] = [];
  for (const e of raw) {
    const t = Number(e.timestamp);
    const ts = iso(t);
    if (!ts || e.deviceId === undefined) continue;
    const dev = String(e.deviceId);
    const prev = last.get(dev);
    const sess = prev && t - prev.at < 30 * 60_000 ? prev.id : `vercel:${dev}:${t}`;
    last.set(dev, { id: sess, at: t });
    const host = (() => { try { return new URL(String(e.origin)).hostname; } catch { return ""; } })();
    const isEvent = e.eventType === "event";
    let props: Record<string, string> = {};
    try { props = Object.fromEntries(Object.entries(JSON.parse(String(e.eventData ?? "{}"))).map(([k, v]) => [k, String(v)])); } catch {}
    out.push({
      ...EMPTY,
      ts,
      type: isEvent ? "event" : "pageview",
      name: isEvent ? String(e.eventName ?? "event").slice(0, 64) : "pageview",
      visitor_id: `vercel:${dev}`,
      session_id: sess,
      hostname: host,
      url_path: String(e.path ?? "/"),
      ...source(String(e.queryParams ?? ""), String(e.referrer ?? ""), host),
      country: String(e.country ?? "").toUpperCase().slice(0, 2),
      region: String(e.region ?? ""),
      city: String(e.city ?? ""),
      browser: String(e.clientName ?? ""),
      os: String(e.osName ?? ""),
      device: device(String(e.deviceType ?? "")),
      props: isEvent ? props : {},
    });
  }
  return out;
}

/** Pins each session's first source onto all its rows, like the live collector does. */
export function pinSessionSources(rows: Base[]): Base[] {
  const first = new Map<string, Base>();
  for (const r of [...rows].sort((a, b) => a.ts.localeCompare(b.ts))) if (!first.has(r.session_id)) first.set(r.session_id, r);
  return rows.map((r) => {
    const f = first.get(r.session_id)!;
    return { ...r, referrer_domain: f.referrer_domain, channel: f.channel, utm_source: f.utm_source, utm_medium: f.utm_medium, utm_campaign: f.utm_campaign, utm_term: f.utm_term, utm_content: f.utm_content };
  });
}
