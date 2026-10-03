// End-to-end suite. Needs the app running on E2E_URL (default http://localhost:3000) with the demo seed loaded:
//   npm run migrate && npm run seed && npm run build && npm start   (in another terminal)
//   npm run e2e
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import postgres from "postgres";

const B = process.env.E2E_URL ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL);
let browser;
const pageErrors = [];

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => pageErrors.push(e.message));
  return p;
}
async function signup(page, email) {
  await page.goto(B + "/signup");
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.click("button:has-text('Create account')");
  await page.waitForURL("**/sites/new");
}
async function loginDemo(page) {
  await page.goto(B + "/login");
  await page.fill("#email", "demo@waypoint.dev");
  await page.fill("#password", "demo1234");
  await page.click("button:has-text('Log in')");
  await page.waitForURL("**/sites");
  await page.click("a:has-text('acme-demo.com')");
  await page.waitForURL(/\/sites\/[0-9a-f-]+$/);
  return page.url();
}
const kpi = (page) => page.locator("a[aria-current] .text-\\[22px\\]").first().innerText();

before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); await sql.end(); });

test("collection: tracker → private mode → dashboard, live, CSV", async () => {
  const page = await newPage();
  await signup(page, `e2e-${Date.now()}@test.dev`);
  await page.fill("#name", "Fixture");
  await page.fill("#domain", "localhost");
  await page.click("button:has-text('Continue')");
  await page.waitForURL("**/settings?welcome=1");
  const siteId = /data-site="([^"]+)"/.exec(await page.locator("pre").first().innerText())[1];
  const dash = page.url().replace("/settings?welcome=1", "");

  const html = `<!doctype html><title>Fixture</title><script defer src="${B}/w.js" data-site="${siteId}" data-allow-localhost="true"></script>
    <button id="cta" data-waypoint-event="cta_click" data-waypoint-prop-location="hero">CTA</button>
    <a id="spa" href="#" onclick="history.pushState({}, '', '/pricing'); return false">spa</a>`;
  const srv = createServer((_, res) => { res.setHeader("content-type", "text/html"); res.end(html); }).listen(5055);
  const visitor = await newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36" });
  await visitor.goto("http://localhost:5055/?utm_source=newsletter&utm_medium=email");
  await visitor.waitForTimeout(400);
  await visitor.click("#cta");
  await visitor.click("#spa");
  assert.equal((await visitor.context().cookies()).length, 0, "private mode sets no cookies");
  assert.equal(await visitor.evaluate(() => localStorage.length), 0, "private mode stores nothing");
  await visitor.waitForTimeout(2500);
  srv.close();

  await page.goto(dash + "?period=today");
  assert.equal(await kpi(page), "1");
  assert.match(await page.locator("section:has(h2:text('Sources')) tbody").innerText(), /Email/);
  assert.match(await page.locator("section:has(h2:text('Pages')) tbody").innerText(), /\/pricing/);
  const csv = await (await page.request.get(dash.replace("/sites/", "/api/sites/") + "/export?dim=channel&period=today")).text();
  assert.match(csv, /^value,visitors,count,share,revenue_minor\nEmail,1,1/);
});

test("access control: other teams get 404 on pages and exports", async () => {
  const owner = await newPage();
  const dash = await loginDemo(owner);
  const other = await newPage();
  await signup(other, `other-${Date.now()}@test.dev`);
  assert.equal((await other.goto(dash)).status(), 404);
  assert.equal((await other.goto(dash.replace("/sites/", "/api/sites/") + "/export?dim=channel")).status(), 404);
});

test("revenue: signed Stripe webhook is attributed, replays and bad signatures rejected", async () => {
  const page = await newPage();
  const dash = await loginDemo(page);
  const siteId = dash.split("/").pop();
  await page.goto(dash + "/visitors");
  const vid = (await page.locator("tbody a").first().getAttribute("href")).split("/visitors/")[1];
  const pi = `pi_e2e_${Date.now()}`;
  const body = JSON.stringify({ id: `evt_${pi}`, type: "checkout.session.completed", created: Math.floor(Date.now() / 1000), data: { object: { id: "cs", mode: "payment", payment_status: "paid", amount_total: 1234, currency: "usd", customer: "cus_e2e", payment_intent: pi, client_reference_id: decodeURIComponent(vid) } } });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", "whsec_demo_not_real").update(`${t}.${body}`).digest("hex");
  const post = (s) => fetch(`${B}/api/webhooks/stripe/${siteId}`, { method: "POST", body, headers: { "stripe-signature": `t=${t},v1=${s}` } });
  assert.deepEqual(await (await post(sig)).json(), { received: true, recorded: 1 });
  assert.deepEqual(await (await post(sig)).json(), { received: true, recorded: 0 });
  assert.equal((await post("00".repeat(32))).status, 400);
  await page.goto(`${dash}/visitors/${vid}`);
  assert.ok(await page.locator("text=$12.34").count());
});

test("REST and MCP return the same numbers as the dashboard", async () => {
  const page = await newPage();
  const dash = await loginDemo(page);
  const visitors = (await kpi(page)).replace(/,/g, "");
  const key = `wp_live_${randomBytes(24).toString("base64url")}`;
  const [org] = await sql`SELECT org_id FROM sites WHERE id = ${dash.split("/").pop()}`;
  await sql`INSERT INTO api_keys (org_id, name, prefix, key_hash) VALUES (${org.org_id}, 'e2e', ${key.slice(0, 12)}, ${createHash("sha256").update(key).digest("hex")})`;
  const H = { authorization: `Bearer ${key}`, "content-type": "application/json" };
  const rest = await (await fetch(`${B}/api/v1/sites/demo/stats?period=30d`, { headers: H })).json();
  assert.equal(String(rest.current.visitors), visitors);
  const rpc = (method, params, id = 1) => fetch(`${B}/api/mcp`, { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) }).then((r) => r.json());
  assert.equal((await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "e2e", version: "1" } })).result.serverInfo.name, "waypoint");
  assert.ok((await rpc("tools/list", {})).result.tools.length >= 10);
  const call = await rpc("tools/call", { name: "get_overview", arguments: { site_id: "demo", period: "30d" } });
  assert.equal(String(call.result.structuredContent.current.visitors), visitors);
  assert.equal((await fetch(`${B}/api/v1/sites`)).status, 401);
});

test("funnels: results, drop-off drilldown and builder validation", async () => {
  const page = await newPage();
  const dash = await loginDemo(page);
  await page.goto(dash + "/funnels");
  await page.click("a:has-text('Pricing → purchase')");
  await page.click("a:has-text('dropped')");
  await page.waitForSelector("text=Where they went instead");
  await page.goto(dash + "/funnels/new");
  await page.fill("#fname", "Bad");
  await page.locator("input[aria-label$='page path']").first().fill("pricing");
  await page.click("button:has-text('Create funnel')");
  assert.match(await page.locator("p[role=alert]").innerText(), /start with \//);
});

test("imports: Umami CSVs import and can be removed", async () => {
  const page = await newPage();
  const dash = await loginDemo(page);
  await page.goto(dash + "/settings");
  await page.locator("input[name=provider][value=umami]").check({ force: true });
  await page.setInputFiles("input[aria-label='Export files']", ["website_event.csv", "session.csv", "event_data.csv"].map((f) => new URL(`./fixtures/${f}`, import.meta.url).pathname));
  await page.click("button:has-text('Start import')");
  await page.waitForFunction(() => [...document.querySelectorAll("li .chip")].some((c) => c.textContent === "done"), null, { timeout: 60_000 });
  const [imp] = await sql`SELECT id, rows_imported FROM imports WHERE provider = 'umami' ORDER BY created_at DESC LIMIT 1`;
  assert.ok(imp.rows_imported > 4000);
  await page.locator("li:has-text('Umami') button:has-text('Remove data')").first().click();
  await page.waitForTimeout(1500);
  assert.equal((await sql`SELECT count(*)::int AS n FROM imports WHERE id = ${imp.id}`)[0].n, 0);
});

test("password reset signs in with the new password, once", async () => {
  const page = await newPage();
  const email = `reset-${Date.now()}@test.dev`;
  await signup(page, email);
  const token = randomBytes(32).toString("base64url");
  const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
  await sql`INSERT INTO password_resets (token_hash, user_id) VALUES (${createHash("sha256").update(token).digest("hex")}, ${u.id})`;
  const fresh = await newPage();
  await fresh.goto(`${B}/reset-password/${token}`);
  await fresh.fill("#password", "newpassword456");
  await fresh.click("button:has-text('Save password')");
  await fresh.waitForURL("**/sites");
  await fresh.goto(`${B}/reset-password/${token}`);
  await fresh.fill("#password", "another-one-789");
  await fresh.click("button:has-text('Save password')");
  assert.match(await fresh.locator("p[role=alert]").innerText(), /expired or was already used/);
});

test("no uncaught page errors", () => {
  assert.deepEqual(pageErrors, []);
});
