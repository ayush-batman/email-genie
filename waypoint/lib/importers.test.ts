import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "./csv.ts";
import { mapDatabuddy, mapUmami, mapVercel, pinSessionSources } from "./importers.ts";

test("csv: quotes, escaped quotes, embedded commas/newlines, CRLF, BOM", () => {
  const rows = parseCsv('﻿a,b,c\r\n1,"x, y","he said ""hi"""\r\n2,"multi\nline",\n');
  assert.deepEqual(rows, [{ a: "1", b: "x, y", c: 'he said "hi"' }, { a: "2", b: "multi\nline", c: "" }]);
  assert.deepEqual(parseCsv(""), []);
});

test("umami: pageviews/events, session join, event_data props, utm + channel", () => {
  const events = parseCsv(
    "event_id,website_id,session_id,visit_id,created_at,url_path,url_query,referrer_domain,page_title,event_type,event_name,hostname\n" +
      "e1,w,s1,v1,2026-01-05 10:00:00,/pricing,utm_source=newsletter&utm_medium=email,,Pricing,1,,acme.com\n" +
      "e2,w,s1,v1,2026-01-05 10:01:00,/pricing,,,Pricing,2,signup,acme.com\n" +
      "e3,w,s2,v2,2026-01-05 11:00:00,/,,www.google.com,Home,1,,acme.com\n",
  );
  const sessions = parseCsv("session_id,browser,os,device,country,subdivision1,city,language\ns1,chrome,Mac OS,laptop,de,BE,Berlin,de-DE\n");
  const data = parseCsv("website_event_id,data_key,string_value,number_value\ne2,plan,pro,\n");
  const rows = mapUmami(events, sessions, data);
  assert.equal(rows.length, 3);
  assert.deepEqual([rows[0]!.type, rows[0]!.channel, rows[0]!.utm_source, rows[0]!.country, rows[0]!.ts], ["pageview", "Email", "newsletter", "DE", "2026-01-05T10:00:00.000Z"]);
  assert.deepEqual([rows[1]!.type, rows[1]!.name, rows[1]!.props], ["event", "signup", { plan: "pro" }]);
  assert.equal(rows[2]!.channel, "Organic Search");
  assert.equal(rows[0]!.session_id, "umami:v1");
});

test("databuddy: screen_view, custom events with properties, page_exit time", () => {
  const rows = mapDatabuddy(parseCsv(
    "id,client_id,event_name,anonymous_id,time,session_id,referrer,url,path,title,browser_name,os_name,device_type,country,utm_source,properties,time_on_page\n" +
      'a,c,screen_view,anon1,2026-02-01 09:00:00.000,sess1,https://chatgpt.com/,https://acme.com/docs?x=1,/docs,Docs,Chrome,macOS,desktop,US,,{},\n' +
      'b,c,cta_click,anon1,2026-02-01 09:00:05.000,sess1,,https://acme.com/docs,/docs,,Chrome,macOS,desktop,US,,"{""plan"":""pro""}",\n' +
      "c,c,page_exit,anon1,2026-02-01 09:01:00.000,sess1,,https://acme.com/docs,/docs,,Chrome,macOS,desktop,US,,{},42.5\n",
  ));
  assert.deepEqual(rows.map((r) => r.type), ["pageview", "event", "ping"]);
  assert.equal(rows[0]!.channel, "AI Assistants");
  assert.deepEqual(rows[1]!.props, { plan: "pro" });
  assert.equal(rows[2]!.engaged_ms, 42500);
});

test("vercel: ndjson and json, 30-minute sessions per device, query utms", () => {
  const nd = [
    { eventType: "pageview", timestamp: 1_700_000_000_000, deviceId: 7, origin: "https://acme.com", path: "/", queryParams: "utm_source=google&utm_medium=cpc", country: "GB", deviceType: "mobile" },
    { eventType: "event", eventName: "signup", eventData: '{"plan":"pro"}', timestamp: 1_700_000_060_000, deviceId: 7, origin: "https://acme.com", path: "/signup" },
    { eventType: "pageview", timestamp: 1_700_000_000_000 + 45 * 60_000, deviceId: 7, origin: "https://acme.com", path: "/" },
  ].map((e) => JSON.stringify(e)).join("\n");
  const rows = pinSessionSources(mapVercel(nd));
  assert.equal(rows.length, 3);
  assert.equal(rows[0]!.session_id, rows[1]!.session_id);
  assert.notEqual(rows[0]!.session_id, rows[2]!.session_id);
  assert.equal(rows[1]!.channel, "Paid Search", "source pinned to the session");
  assert.deepEqual(rows[1]!.props, { plan: "pro" });
  assert.equal(mapVercel(`[${JSON.stringify({ eventType: "pageview", timestamp: 1, deviceId: 1, path: "/a" })}]`).length, 1);
});
