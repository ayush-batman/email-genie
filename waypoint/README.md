# Waypoint

Privacy-friendly, revenue-aware web analytics for founders and small teams: where visitors come from, where they leave, and what turns into revenue.

Spec: [`../docs/analytics-clone-build-prompt.md`](../docs/analytics-clone-build-prompt.md) · What's built and known limits: [`docs/STATUS.md`](docs/STATUS.md) · User docs: `/docs` in the app.

## Features

- **Tracking script** (`public/w.js`, 2.4 KB gzipped): pageviews incl. SPA routes, engaged time, outbound links, downloads, custom events with properties, `identify()`; Private (cookieless) and Product modes
- **Dashboard**: KPIs with period comparison, interactive chart, sources/pages/locations/devices/events/goals, filters, custom ranges, CSV export, public share links
- **Live**: visitors online and a real-time feed (Server-Sent Events)
- **Visitors**: profiles with first/last touch, visit timelines, cross-device `identify()`, GDPR export/delete
- **Goals, funnels, retention**: step conversion, drop-off drilldown, time between steps, breakdowns, weekly cohorts
- **Revenue**: signed webhooks for Stripe, Lemon Squeezy, Polar, Paddle, or a server API; first/last-touch attribution
- **Teams**: invites, roles, audit log
- **API & MCP**: REST API with OpenAPI spec, MCP server for Claude/Cursor/VS Code, in-app Ask assistant
- **Imports & export**: Umami, Databuddy, Vercel Analytics; full CSV/NDJSON export
- **Billing**: plans, Stripe Checkout/Portal, usage limits, trial lifecycle, reminder emails
- **Marketing site**: landing, pricing, docs, public demo (`/share/demo`)

## Stack

One Next.js app. Postgres for accounts and settings, ClickHouse for events. Dependencies are deliberately few: `postgres`, `@clickhouse/client`, `zod`, `lucide-react`, `@anthropic-ai/sdk` (Ask only). Stripe, Resend and the MCP protocol are spoken over plain HTTP.

```
public/w.js              tracker
app/api/e                collection endpoint (validate → bot filter → enrich → sessionize → batched insert)
app/api/v1, app/api/mcp  REST API and MCP server (both wrap lib/tools.ts)
app/api/webhooks         payment provider webhooks; app/api/billing/webhook for Waypoint's own billing
app/api/cron/digests     daily job: email reports, trial and usage reminders
lib/stats.ts             dashboard queries      lib/funnels.ts   funnels, retention
lib/revenue.ts           attribution + reports  lib/payments.ts  webhook verification/parsing
lib/visitors.ts          profiles, GDPR         lib/importers.ts Umami/Databuddy/Vercel mappers
lib/tools.ts             shared read-only tool registry (REST, MCP, Ask)
db/*.sql                 schemas (idempotent)
e2e/app.test.mjs         browser end-to-end suite
```

## Run locally

```bash
docker compose up -d            # Postgres + ClickHouse
cp .env.example .env.local
npm install
npm run migrate
npm run seed                    # demo account: demo@waypoint.dev / demo1234
npm run dev                     # http://localhost:3000, public demo at /share/demo
```

Checks:

```bash
npm test                        # unit tests (node:test)
npm run typecheck
npm run build && npm start      # then, in another terminal:
npm run e2e                     # browser suite (Playwright)
npm run bench -- 10000000       # query timings on 10M synthetic events
```

Schedule `GET /api/cron/digests` daily with `Authorization: Bearer $CRON_SECRET`. Optional integrations (Resend, Stripe, Anthropic) are configured in `.env.local`; each feature degrades cleanly without its key.
