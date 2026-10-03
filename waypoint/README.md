# Waypoint

Privacy-friendly, revenue-aware web analytics for founders and small teams. Shows where visitors come from, where they leave, and what turns into revenue.

Full product spec: [`../docs/analytics-clone-build-prompt.md`](../docs/analytics-clone-build-prompt.md). What's built vs. not: [`docs/STATUS.md`](docs/STATUS.md).

## Stack

One Next.js app. Postgres for accounts/sites, ClickHouse for events. No ORM, no Redis, no chart library.

```
public/w.js            tracker (<3 KB gz): pageviews, SPA routes, outbound/download clicks, custom events, engaged time
app/api/e              collection endpoint: validate → bot filter → enrich (UA, geo, channel, UTMs) → sessionize → ClickHouse
lib/stats.ts           every analytics query (KPIs, time series, breakdowns, live)
components/dashboard   server-rendered dashboard: filters, comparisons, panels, CSV export
app/sites/[id]/live    real-time feed over Server-Sent Events
lib/visitors.ts        visitor list, profiles, GDPR export/delete
lib/payments.ts        webhook signature checks + payload parsing (Stripe, Lemon Squeezy, Polar, Paddle)
lib/revenue.ts         records verified payments with attribution; revenue report queries
db/*.sql               schemas (idempotent; `npm run migrate`)
```

## Run locally

```bash
docker compose up -d            # Postgres + ClickHouse
cp .env.example .env.local
npm install
npm run migrate
npm run seed                    # demo account: demo@waypoint.dev / demo1234
npm run dev                     # http://localhost:3000 — public demo at /share/demo
npm test                        # unit tests (node:test)
```

## Install on a site

```html
<script defer src="https://YOUR_HOST/w.js" data-site="SITE_PUBLIC_ID"></script>
```

```js
waypoint.track("signup", { plan: "pro" });                  // custom event
<button data-waypoint-event="cta_click" data-waypoint-prop-location="hero">  // no-JS event
waypoint.identify(user.id); waypoint.getVisitorId();       // Product mode only
```

Attributes: `data-mode="product"`, `data-api`, `data-auto-pageview="false"`, `data-outbound="false"`, `data-downloads="false"`, `data-hash="true"`, `data-exclude="/admin/*"`, `data-allow-localhost="true"`, `data-debug="true"`.

## Revenue

Connect a provider under **Settings → Revenue** (webhook URL + signing secret), and pass the visitor at checkout:

```js
metadata: { waypoint_visitor_id: waypoint.getVisitorId() }   // Stripe / Polar; custom_data for Lemon Squeezy / Paddle
```

Or report payments from any backend: `POST /api/v1/revenue` with `Authorization: Bearer wp_sk_…` and `{ site_id, amount, currency, order_id, visitor_id | user_id | session_id | customer_id }`.

## Privacy modes

- **Private** (default): no cookies or storage. Visitor = `sha256(daily salt, site, IP, UA)`; the salt rotates daily and old salts are deleted, so visitors can't be linked across days. IPs are never stored.
- **Product**: random visitor ID in `localStorage`; enables returning visitors and `identify()`. May need consent.
