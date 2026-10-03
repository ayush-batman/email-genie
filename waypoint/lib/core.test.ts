import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyChannel, referrerDomain } from "./channels.ts";
import { buildRow, isBot, parseUserAgent, privateVisitorId, sessionize } from "./collect.ts";
import { resolvePeriod } from "./dates.ts";
import { decodeFilters, encodeFilters } from "./query.ts";

test("channel classification", () => {
  const cases: [Parameters<typeof classifyChannel>[0], string][] = [
    [{ referrerDomain: "" }, "Direct"],
    [{ referrerDomain: "google.com" }, "Organic Search"],
    [{ referrerDomain: "google.co.uk" }, "Organic Search"],
    [{ referrerDomain: "google.com", clickIdType: "gclid" }, "Paid Search"],
    [{ referrerDomain: "", utmSource: "google", utmMedium: "cpc" }, "Paid Search"],
    [{ referrerDomain: "chatgpt.com" }, "AI Assistants"],
    [{ referrerDomain: "", utmSource: "chatgpt.com" }, "AI Assistants"],
    [{ referrerDomain: "news.ycombinator.com" }, "Organic Social"],
    [{ referrerDomain: "t.co" }, "Organic Social"],
    [{ referrerDomain: "", utmSource: "facebook", utmMedium: "cpc" }, "Paid Social"],
    [{ referrerDomain: "", utmMedium: "paid_social" }, "Paid Social"],
    [{ referrerDomain: "news.ycombinator.com", utmMedium: "email" }, "Email"],
    [{ referrerDomain: "mail.google.com" }, "Email"],
    [{ referrerDomain: "", utmMedium: "affiliate" }, "Affiliates"],
    [{ referrerDomain: "", utmMedium: "display" }, "Display"],
    [{ referrerDomain: "github.com" }, "Referral"],
    [{ referrerDomain: "", utmSource: "partnerblog" }, "Other"],
  ];
  for (const [input, want] of cases) assert.equal(classifyChannel(input), want, JSON.stringify(input));
  assert.equal(referrerDomain("https://www.Example.com/a", "example.com"), "");
  assert.equal(referrerDomain("https://www.google.com/", "example.com"), "google.com");
  assert.equal(referrerDomain("not a url", "example.com"), "");
});

test("user agents and bots", () => {
  assert.deepEqual(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"), { browser: "Safari", os: "iOS", device: "mobile" });
  assert.deepEqual(parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Edg/128.0"), { browser: "Edge", os: "Windows", device: "desktop" });
  assert.deepEqual(parseUserAgent("Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"), { browser: "Chrome", os: "Android", device: "tablet" });
  assert.ok(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"));
  assert.ok(isBot("Mozilla/5.0 HeadlessChrome/120"));
  assert.ok(isBot(""));
  assert.ok(!isBot("Mozilla/5.0 (Macintosh) Chrome/128.0 Safari/537.36"));
});

test("buildRow parses UTMs, click ids and props; private visitor id depends on salt", () => {
  const row = buildRow(
    { s: "x", t: "event", n: "signup", u: "https://acme.com/pricing?utm_source=google&utm_medium=cpc&utm_campaign=brand&gclid=1", r: "https://www.google.com/", ti: "", l: "en", w: 390, p: { plan: "pro", seats: 3 } },
    { siteId: "s", visitorId: "v", ua: "Mozilla/5.0 (Macintosh) Chrome/128.0 Safari/537.36", geo: { country: "US", region: "", city: "" }, now: new Date(0) },
  );
  assert.equal(row.channel, "Paid Search");
  assert.equal(row.utm_campaign, "brand");
  assert.equal(row.url_path, "/pricing");
  assert.equal(row.name, "signup");
  assert.equal(row.screen_bucket, "XS");
  assert.deepEqual(row.props, { plan: "pro", seats: "3" });
  assert.notEqual(privateVisitorId("salt-a", "s", "1.2.3.4", "ua"), privateVisitorId("salt-b", "s", "1.2.3.4", "ua"));
});

test("sessionize pins source for 30 minutes of activity", () => {
  let n = 0;
  const id = () => `s${++n}`;
  const mk = (channel: string) => ({ channel, referrer_domain: channel === "Direct" ? "" : "google.com", utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "", session_id: "" }) as unknown as Parameters<typeof sessionize>[0];
  const a = mk("Organic Search"), b = mk("Direct"), c = mk("Direct");
  sessionize(a, "k", 0, id);
  sessionize(b, "k", 29 * 60_000, id);
  sessionize(c, "k", 29 * 60_000 + 30 * 60_000, id);
  assert.equal(b.session_id, a.session_id);
  assert.equal(b.channel, "Organic Search");
  assert.notEqual(c.session_id, a.session_id);
  assert.equal(c.channel, "Direct");
});

test("periods resolve in the site timezone", () => {
  const now = new Date("2026-03-08T12:00:00Z"); // DST starts in New York this day
  const today = resolvePeriod("today", "America/New_York", { now });
  assert.equal(today.from.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(today.to.toISOString(), "2026-03-09T04:00:00.000Z");
  const d7 = resolvePeriod("7d", "Asia/Kolkata", { now });
  assert.equal(d7.from.toISOString(), "2026-03-01T18:30:00.000Z");
  assert.equal(d7.interval, "day");
  const custom = resolvePeriod("custom", "UTC", { now, from: "2026-01-01", to: "2026-01-31" });
  assert.equal(custom.to.toISOString(), "2026-02-01T00:00:00.000Z");
});

test("filters round-trip through the URL and reject unknown dims", () => {
  const f = [{ dim: "page" as const, op: "contains" as const, value: "a|b:c d" }, { dim: "channel" as const, op: "is" as const, value: "" }];
  assert.deepEqual(decodeFilters(encodeFilters(f)), f);
  assert.deepEqual(decodeFilters("bogus:is:x|page:drop:x"), []);
});

test("rate limits: windows reset, and only failures block logins", async () => {
  const { allow, blocked, recordFailure } = await import("./rate-limit.ts");
  assert.ok((await allow("k", 2, 1000, 0)) && (await allow("k", 2, 1000, 1)));
  assert.ok(!(await allow("k", 2, 1000, 2)));
  assert.ok(await allow("k", 2, 1000, 1001), "new window");
  for (let i = 0; i < 3; i++) await recordFailure("f", 1000, 10);
  assert.ok(await blocked("f", 3, 11));
  assert.ok(!(await blocked("f", 3, 2000)));
});
