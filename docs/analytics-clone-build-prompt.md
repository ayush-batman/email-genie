# Build Prompt: Revenue-Aware Web Analytics SaaS (feature parity with tracwell.app)

> Paste everything below the line into a coding agent. It is written to be self-contained.
> Product codename used throughout: **Waypoint** (swap freely). Do **not** reuse Tracwell's name, logo, copy, or visual identity — we are matching features, not branding.

---

## 0. Your role and how to work

You are a senior full-stack engineer building **Waypoint**, a production-grade, privacy-friendly web analytics SaaS for founders and small teams. Its job is to answer three questions: **where do visitors come from, where do they drop off, and which sources turn into revenue.**

Working rules:

1. Build in the milestone order in §14. Each milestone must end with the app running, migrations applied, tests passing, and a short `CHANGELOG.md` entry. Commit at the end of every milestone.
2. Do not stub features silently. If something truly can't be finished (e.g. needs a third-party account), implement it behind a clearly named interface, add a fake/in-memory implementation used in tests, and list it in `docs/KNOWN_GAPS.md`.
3. Where this spec says "research", read the vendor's current public docs before writing code (Stripe, Lemon Squeezy, Polar, Paddle, Umami, Databuddy, Vercel Analytics, MCP spec). Do not guess payload shapes.
4. Prefer boring, well-documented libraries. No experimental ORMs, no beta frameworks.
5. Every number shown in the UI must be traceable to one query function with a unit/integration test against seeded fixture data.
6. TypeScript `strict: true` everywhere. No `any` except at validated boundaries.

---

## 1. Product summary (what we're matching)

Feature areas, each must ship:

| # | Feature area | One-line requirement |
|---|---|---|
| F1 | **Live activity** | Real-time count of visitors online and a streaming feed of new pageviews/events. |
| F2 | **Ask your analytics (MCP)** | An MCP server so Claude/Cursor/other AI tools can query a site's analytics in natural language. Plus a REST API. |
| F3 | **Understand each visitor** | Per-visitor profile: sessions, page journey, events, source, device, geo, revenue. |
| F4 | **Find where people leave** | Funnels with step conversion, drop-off, time-to-convert, breakdowns. |
| F5 | **Turn actions into reports** | Custom events with properties; goals; saved reports built from events. |
| F6 | **Connect revenue and results** | Backend-verified payments (webhooks + server API) attributed to source/campaign/page/funnel. |
| F7 | **Work better together** | Organizations, members, roles, invites, shared dashboards. |
| F8 | **Analytics without cookies** | Two data-collection modes per site: **Private** (cookieless, no persistent identity) and **Product** (first-party storage, recognizes returning visitors). |
| F9 | **Keep your history** | Import historical data from Umami, Databuddy, and Vercel Analytics. |
| F10 | **Core analytics** | Automatic pageviews, sources/referrers/UTMs, pages, entry/exit, geo, devices, browsers, OS, bounce, duration, filters, comparisons. |
| F11 | **Multi-site + export** | Multiple websites per org (plan-limited), CSV export of any table. |
| F12 | **Billing** | 7-day free trial, plan tiers with website/event limits, Stripe subscriptions. |
| F13 | **Public demo + marketing site** | "Explore demo" opens a read-only dashboard on seeded data; landing, pricing, docs pages. |

---

## 2. Tech stack (decided — don't relitigate)

- **Monorepo:** pnpm workspaces + Turborepo.
  - `apps/web` — Next.js (App Router, latest stable), React, TypeScript, Tailwind CSS, shadcn/ui, Recharts (charts), react-simple-maps or MapLibre (geo map), TanStack Query (client data), Zod (validation).
  - `apps/ingest` — standalone Node service (Fastify) for the high-volume collection endpoint. Kept separate from Next.js so it can scale independently.
  - `apps/worker` — background jobs (BullMQ on Redis): imports, webhook processing, rollups, emails, usage metering.
  - `apps/mcp` — MCP server (official `@modelcontextprotocol/sdk`), Streamable HTTP transport, also runnable over stdio.
  - `packages/tracker` — the browser script (vanilla TS, built with esbuild/tsup to a single minified IIFE, **< 3 KB gzipped**).
  - `packages/node-sdk` — server-side SDK (`track`, `identify`, `revenue`).
  - `packages/db` — Postgres schema (Drizzle ORM + drizzle-kit migrations).
  - `packages/events` — ClickHouse schema, migrations, and **all analytics query functions** (shared by web, API, MCP).
  - `packages/shared` — Zod schemas, types, constants, plan definitions.
- **Postgres 16** — users, orgs, sites, members, billing, API keys, funnels, reports, goals, imports metadata.
- **ClickHouse** — raw events + sessions (event store). All analytics queries hit ClickHouse.
- **Redis** — live presence, rate limiting, BullMQ queues, short-lived caches.
- **Auth:** Better Auth (or Auth.js) — email+password, magic link, Google and GitHub OAuth, email verification, password reset, sessions in Postgres.
- **Email:** Resend (transactional) with React Email templates.
- **Billing:** Stripe Checkout + Customer Portal + webhooks.
- **Geo:** MaxMind GeoLite2-City (`.mmdb`, loaded in memory in `apps/ingest`; download script in `scripts/`). Store country, region, city only — never store IPs.
- **UA parsing:** `ua-parser-js`. **Bot detection:** `isbot` + datacenter ASN/IP list + heuristics (§4.4).
- **Local dev:** `docker-compose.yml` with Postgres, ClickHouse, Redis, Mailpit. `pnpm dev` starts everything. `pnpm seed` loads demo data.
- **Tests:** Vitest (unit/integration, with Testcontainers for Postgres/ClickHouse), Playwright (E2E).
- **Deploy target:** Docker images for each app; document Fly.io/Railway + ClickHouse Cloud + managed Postgres/Redis. Tracker served from CDN with long cache + versioned URL.

---

## 3. Tracking script (`packages/tracker`)

### 3.1 Install snippet

```html
<script defer src="https://cdn.waypoint.example/w.js" data-site="SITE_PUBLIC_ID"></script>
```

Optional attributes:

| Attribute | Default | Meaning |
|---|---|---|
| `data-site` | required | Public site ID (not secret). |
| `data-api` | `https://in.waypoint.example/e` | Override collection endpoint (supports proxying through customer's own domain to dodge ad-blockers). |
| `data-mode` | site setting | `private` or `product`; server-side site setting wins if they conflict. |
| `data-auto-pageview` | `true` | Disable to fire pageviews manually. |
| `data-outbound` | `true` | Track outbound link clicks as `outbound_click`. |
| `data-downloads` | `true` | Track file downloads (pdf, zip, dmg, exe, csv, xlsx, docx, mp4…) as `file_download`. |
| `data-hash` | `false` | Treat `#hash` changes as pageviews (hash routers). |
| `data-exclude` | — | Comma-separated path globs to ignore (`/admin/*,/preview/*`). |
| `data-respect-dnt` | `false` | If `true`, honor `navigator.doNotTrack` / GPC. |
| `data-debug` | `false` | Log to console instead of sending. |

### 3.2 Behavior

- Automatic pageviews on load and on SPA navigation (patch `history.pushState`/`replaceState`, listen to `popstate`; dedupe same-URL repeats within 500 ms).
- Capture: URL (strip configured query params; always keep `utm_*`, `ref`, `source`, `via`, `gclid`, `fbclid`, `msclkid` → normalize to `click_id_type`), `document.referrer`, `document.title`, screen width (bucketed), language, timezone.
- **Engagement / duration:** send a `pagehide`/`visibilitychange` "ping" with active time on page (only counting time while tab is visible). Use `navigator.sendBeacon`, fall back to `fetch(..., {keepalive:true})`.
- Never sends when on `localhost`/`127.0.0.1`/`file:` unless `data-debug` or `data-allow-localhost`.
- Queue calls made before script loads: `window.waypoint = window.waypoint || function(){(window.waypoint.q=window.waypoint.q||[]).push(arguments)}`.
- Zero dependencies. No cookies in Private mode. Must not throw on any page; wrap everything in try/catch.

### 3.3 Public JS API

```ts
waypoint.track(name: string, props?: Record<string, string | number | boolean>, opts?: { revenue?: { amount: number; currency: string } }): void
waypoint.pageview(opts?: { url?: string; referrer?: string; title?: string }): void
waypoint.identify(userId: string, traits?: Record<string, string | number | boolean>): void   // Product mode only; no-op + console warning in Private
waypoint.reset(): void                         // clears stored visitor id (logout)
waypoint.getVisitorId(): string | null        // Product mode: stored id; Private: null
waypoint.optOut(): void / waypoint.optIn(): void   // persisted in localStorage flag
```

Declarative events: any element with `data-waypoint-event="signup_click"` and optional `data-waypoint-prop-plan="pro"` fires on click.

Limits enforced client- and server-side: event name ≤ 64 chars `[a-zA-Z0-9_.:-]`, ≤ 30 props, keys ≤ 64 chars, values ≤ 512 chars.

### 3.4 Data-collection modes (F8)

- **Private mode (default, cookieless):** no cookies, no localStorage, no fingerprinting beyond the following server-side hash:
  `visitor_hash = sha256(daily_salt || site_id || truncated_ip || user_agent)` → first 16 bytes.
  `daily_salt` is random, stored in Redis, rotated every 24 h at UTC midnight and the old one deleted, so visitors cannot be linked across days. The IP is used in memory only for geo + hashing and is never written anywhere (including logs). Consequences to document in UI: "returning visitor" and visitor profiles are limited to the same day; `identify` is disabled.
- **Product mode:** tracker stores a random UUID v4 in `localStorage` (`wp_vid`) (fallback: first-party cookie `wp_vid`, `SameSite=Lax`, 400-day max) and a session id in `sessionStorage`. Enables cross-day returning visitors, full visitor profiles, `identify()`, and checkout attribution via `getVisitorId()`. The settings page must show a notice that this mode may require consent under GDPR/ePrivacy and link to a consent-integration doc.
- Mode is a per-site setting, changeable at any time; switching shows a confirmation explaining the effect on historic data (none — it only affects new data).

---

## 4. Ingestion (`apps/ingest`)

### 4.1 Endpoints

- `POST /e` — browser events. Body (JSON or `text/plain` for beacon):
  ```json
  { "s":"site_public_id","t":"pageview|event|ping|identify","n":"event_name","u":"https://…","r":"referrer","ti":"title",
    "w":1440,"l":"en-US","tz":"Europe/Berlin","p":{"plan":"pro"},"vid":"uuid-or-null","sid":"uuid-or-null",
    "et":12345,"rev":{"a":4900,"c":"USD"}, "uid":"user-123" }
  ```
  Respond `202` with empty body fast (< 10 ms p50 after validation); actual writes are batched.
- `POST /v1/server/events` — server-side events/revenue via secret API key (`Authorization: Bearer wp_sk_…`). Used by `packages/node-sdk`.
- `GET /health`.

### 4.2 Pipeline

1. Validate with Zod; reject oversized bodies (> 16 KB).
2. Resolve site by public id (cached in-memory, 60 s TTL, invalidated via Redis pub/sub). Reject if site disabled, over hard quota, or hostname doesn't match the site's allowed domains (configurable list incl. wildcards `*.example.com`).
3. Drop bots (§4.4) — but count them in a `bot_events_daily` counter for transparency.
4. Enrich: geo (country/region/city) from IP, UA → browser/version/OS/version/device type, referrer → `referrer_domain` + `channel` classification (§4.3), UTM parse, click-ID type.
5. Identity: compute `visitor_id` (Private: hash; Product: client `vid`). Sessionize: session = same visitor with gap < 30 min, and new session on UTM/referrer change from an external source; session id stored in Redis with 30-min sliding TTL.
6. Update Redis presence: `ZADD live:{site} now visitor_id`; publish to `live:{site}` channel (for SSE).
7. Buffer and batch-insert into ClickHouse (flush every 1 s or 5,000 rows) via async insert.
8. Increment monthly usage counter in Redis; worker persists hourly to Postgres for billing.
9. Rate limit per IP+site (e.g. 50 req/s burst) and per site (plan-based).

### 4.3 Channel classification

Rules engine (unit-tested table) producing one of: `Direct`, `Organic Search`, `Paid Search`, `Organic Social`, `Paid Social`, `Email`, `Referral`, `AI Assistants` (chatgpt.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com…), `Affiliates`, `Display`, `Other`. Uses UTM medium/source, click IDs, and a maintained referrer-domain map in `packages/shared/channels.ts`.

### 4.4 Bot filtering

`isbot` on UA; headless markers; known datacenter ASNs; requests with no `Accept-Language`; > N pageviews/min from one visitor; prefetch headers (`Purpose: prefetch`, `Sec-Purpose`). Configurable per-site IP/user-agent exclude list (e.g. "exclude my own visits" toggle that sets a localStorage flag through a special link).

---

## 5. Data model

### 5.1 ClickHouse

```sql
CREATE TABLE events (
  site_id        UUID,
  event_id       UUID,
  ts             DateTime64(3, 'UTC'),
  type           LowCardinality(String),   -- pageview | event | ping | revenue | identify
  name           LowCardinality(String),   -- 'pageview' or custom name
  visitor_id     String,
  session_id     String,
  user_id        String DEFAULT '',        -- from identify (Product mode)
  url_path       String,
  url_query      String,
  hostname       LowCardinality(String),
  title          String,
  referrer       String,
  referrer_domain LowCardinality(String),
  channel        LowCardinality(String),
  utm_source     LowCardinality(String),
  utm_medium     LowCardinality(String),
  utm_campaign   String,
  utm_term       String,
  utm_content    String,
  click_id_type  LowCardinality(String),
  country        LowCardinality(FixedString(2)),
  region         LowCardinality(String),
  city           String,
  browser        LowCardinality(String),
  browser_version String,
  os             LowCardinality(String),
  os_version     String,
  device         LowCardinality(String),  -- desktop | mobile | tablet
  screen_bucket  LowCardinality(String),
  language       LowCardinality(String),
  engaged_ms     UInt32,
  props          Map(String, String),
  revenue_minor  Int64 DEFAULT 0,          -- in minor units, converted to site currency
  revenue_currency LowCardinality(String) DEFAULT '',
  source         LowCardinality(String) DEFAULT 'tracker'  -- tracker | server | import:umami | import:databuddy | import:vercel | webhook:stripe …
) ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (site_id, toDate(ts), visitor_id, ts)
TTL toDateTime(ts) + INTERVAL 10 YEAR;
```

Plus:
- `sessions` — `AggregatingMergeTree` materialized view keyed by `(site_id, session_id)` with: start/end ts, entry path, exit path, pageview count, event count, engaged ms, first-touch source fields, geo/device, revenue sum, `is_bounce` (1 pageview and < 10 s engaged and no events).
- `visitors` — `ReplacingMergeTree` with first_seen, last_seen, first-touch attribution, last-touch attribution, user_id, traits (Map), lifetime revenue, session count.
- Hourly/daily rollup MVs for the main dashboard metrics per site (used when range > 31 days).

### 5.2 Postgres (Drizzle)

Tables (all with `id uuid pk`, `created_at`, `updated_at`):

- `users`, `accounts`, `sessions`, `verification_tokens` (auth library's schema).
- `organizations` (name, slug, plan, trial_ends_at, stripe_customer_id, billing_email).
- `memberships` (org_id, user_id, role: `owner|admin|member|viewer`).
- `invitations` (org_id, email, role, token hash, expires_at, accepted_at).
- `sites` (org_id, name, domain, public_id (short nanoid), allowed_hostnames[], mode `private|product`, timezone, currency, excluded_ips[], excluded_paths[], strip_query_params[], is_public bool, public_share_token, bot_filter_level, created_by, archived_at).
- `goals` (site_id, name, type `pageview|event`, match: path pattern or event name + prop filters, revenue_value optional).
- `funnels` (site_id, name, steps jsonb `[{type, match, label}]`, window_hours default 24, strict_order bool).
- `reports` (site_id, name, definition jsonb — see §8.5, pinned_to_dashboard bool, created_by).
- `segments` (site_id, name, filters jsonb) — saved filter sets.
- `annotations` (site_id, date, text, created_by) — shown on charts.
- `api_keys` (org_id, name, prefix, hash (argon2id), scopes[], site_ids[] nullable = all, last_used_at, revoked_at).
- `revenue_connections` (site_id, provider `stripe|lemonsqueezy|polar|paddle|custom`, webhook_secret encrypted, account_label, status, last_event_at).
- `revenue_events_raw` (connection_id, provider_event_id unique, payload jsonb, processed_at, error) — idempotency + audit.
- `imports` (site_id, provider, status `queued|validating|running|done|failed`, file_key, rows_total, rows_imported, date_from, date_to, error, created_by).
- `subscriptions` (org_id, stripe_subscription_id, price_id, status, current_period_end, cancel_at_period_end).
- `usage_monthly` (org_id, month, events_count).
- `email_reports` (site_id, user_id, frequency `weekly|monthly`, last_sent_at).
- `audit_log` (org_id, actor_id, action, target, meta jsonb).

Row-level authorization is enforced in a single `authorize(ctx, orgId|siteId, minRole)` helper used by every route, server action, API handler, and MCP tool. Write tests that a `viewer` cannot mutate and that cross-org access returns 404.

---

## 6. Web app information architecture (`apps/web`)

### 6.1 Public/marketing (statically rendered)

- `/` landing: hero ("know where visitors come from, where they leave, and what turns into revenue"), primary CTA **Start 7-day free trial**, secondary **Explore demo**; sections for each feature area F1–F9 with real screenshots from the seeded demo; privacy section explaining both modes; "Ask your analytics" section showing an MCP chat example; import section; FAQ; footer.
- `/pricing` — plan table driven by `packages/shared/plans.ts` (single source of truth used by billing enforcement too).
- `/demo` → redirects to `/share/{demo_token}` read-only dashboard of seeded site.
- `/docs/*` — MDX docs: Quick start, Script attributes, JS API, Custom events, Revenue (one page per provider), Server SDK, REST API reference (generated from OpenAPI), MCP setup (Claude Desktop, Claude Code, Cursor configs), Imports (one per source), Proxying the script, Privacy & modes, Team & roles, Data export.
- `/privacy`, `/terms`, `/changelog`.
- `/login`, `/signup`, `/forgot-password`, `/invite/[token]`.

### 6.2 App (authenticated)

```
/app                                      → redirect to last site or onboarding
/app/onboarding                           → create org → "Connect your first website" → install snippet → live "waiting for first event" check
/app/[org]/sites                          → site list with sparkline + today's visitors
/app/[org]/[site]                         → Overview dashboard (§7)
/app/[org]/[site]/live                    → Live activity (F1)
/app/[org]/[site]/visitors                → Visitor list
/app/[org]/[site]/visitors/[visitorId]    → Visitor profile (F3)
/app/[org]/[site]/funnels(/[id])          → Funnels (F4)
/app/[org]/[site]/events                  → Custom events explorer
/app/[org]/[site]/reports(/[id])          → Reports (F5)
/app/[org]/[site]/goals                   → Goals
/app/[org]/[site]/revenue                 → Revenue attribution (F6)
/app/[org]/[site]/settings/{general,tracking,revenue,imports,sharing,danger}
/app/[org]/settings/{members,api-keys,billing,mcp,notifications}
/app/account
/share/[token]                            → public read-only dashboard
```

Global UI: site switcher, date-range picker (Today, Yesterday, Last 7/30/90 days, This/Last month, Year to date, Last 12 months, All time, Custom; plus "compare to previous period / same period last year"), filter bar, timezone = site timezone, dark/light mode, ⌘K command palette, keyboard shortcuts (`d` date, `f` filter, `/` search). Every table: sort, search, paginate, "Export CSV". Fully responsive down to 360 px.

---

## 7. Overview dashboard (F10)

- **KPI row:** Visitors, Visits (sessions), Pageviews, Views/visit, Bounce rate, Avg. visit duration, Conversions (goal completions), Revenue, Conversion rate, Revenue per visitor. Each with delta vs comparison period and sparkline. Clicking a KPI switches the main chart metric.
- **Main chart:** line/bar over time with auto granularity (minute for today/realtime, hour ≤ 2 days, day ≤ 90 days, week/month beyond); comparison overlay; annotations.
- **Panels (each a tab group, each row clickable to add as filter, each with "View all" modal + CSV):**
  - Sources: Channels · Referrers · UTM Source · UTM Medium · UTM Campaign · UTM Term · UTM Content
  - Pages: Top pages · Entry pages · Exit pages (exit rate) · Page titles · Hostnames
  - Locations: Map (choropleth) · Countries · Regions · Cities
  - Devices: Device type · Browsers (+version drilldown) · OS (+version) · Screen sizes · Languages
  - Events: Custom events (count, unique visitors, conversion rate) with property breakdown drilldown
  - Goals: completions, conversion rate, revenue
- Each source/page row also shows **revenue and conversions** for that dimension when revenue or goals exist (this is the core value — every table can answer "which of these makes money?").
- **Filters:** any dimension, operators `is / is not / contains / does not contain / matches regex`, combined with AND; also "visitors who did event X" / "visitors who completed goal Y" segment filters; save as segment. Filters serialize to URL query string so links are shareable.
- Performance budget: overview for a site with 10 M events/month loads in < 1.5 s p95 (rollups + ClickHouse query concurrency + 60 s cache keyed by query hash for non-today ranges).

---

## 8. Feature specs

### 8.1 Live activity (F1)

- Big number: visitors online now (distinct visitors with an event in last 5 min, from Redis ZSET; prune on read).
- Real-time feed via **Server-Sent Events** (`/api/sites/[id]/live/stream`, auth-checked) backed by Redis pub/sub: each item shows time, event/page, visitor (anonymized label like "Amber Otter" deterministically from visitor id), country flag, device icon, source. Pause/resume, filter by event type.
- Panels for last 30 min: top active pages, top sources, countries, per-minute bar chart.
- Globe/map with dots for active visitor cities.
- Optional toast/sound on revenue event or goal completion.

### 8.2 Visitor profiles (F3)

- **Visitor list:** paginated table — anonymized name or identified user id/email trait, first seen, last seen, sessions, pageviews, country, device, first-touch source, lifetime revenue. Filter + search by user id / traits.
- **Profile page:** header (identity, traits, first/last touch attribution, total revenue, LTV); session list; each session expandable into an ordered **timeline** (pageviews with time-on-page, custom events with props, revenue events, outbound clicks); journey visualization (path graph of the session).
- In Private mode show the honest limitation banner: profiles are scoped to a single day; cross-day history requires Product mode.
- `identify()` merges: prior anonymous visitor_id ↔ user_id mapping stored in `visitors`; queries resolve on `user_id` when present.
- GDPR tools: "delete this visitor's data" (ClickHouse lightweight `DELETE` by visitor_id/user_id; logged in audit_log) and "export this visitor's data" (JSON).

### 8.3 Funnels (F4)

- Builder: 2–10 steps; each step = pageview (path exact/prefix/regex) or custom event (name + optional prop filters); conversion window (1 h–90 days); order strict vs any-order; optional global filters/segment.
- Computation via ClickHouse `windowFunnel(window, 'strict_order'?)` over visitor_id (or user_id when identified).
- Output: horizontal funnel bars with count, % of first step, % of previous step, drop-off count; **median and p75 time between steps**; breakdown by any dimension (channel, utm_source, country, device…) shown as side-by-side bars; trend of overall conversion over time.
- Click on a drop-off → list of visitors who dropped at that step (links to profiles; Product mode) and "where did they go instead" (top next pages/events after the last completed step).
- Revenue: show revenue generated by visitors completing the funnel.

### 8.4 Custom events & goals (F5)

- Events explorer: every event name seen, count, unique visitors, first/last seen; drill into property keys → value distribution; timeline chart.
- Goals: create from pageview pattern or event (+ prop filters); optional fixed monetary value. Goals appear in KPI row, overview Goals panel, and as funnel steps / filters.

### 8.5 Reports (F5)

A report = saved query with a visual:
```ts
type ReportDefinition = {
  kind: "trend" | "breakdown" | "table" | "number" | "funnel_ref" | "retention";
  metric: "visitors"|"sessions"|"pageviews"|"events"|"unique_events"|"conversions"|"conversion_rate"|"revenue"|"revenue_per_visitor"|"bounce_rate"|"avg_duration";
  event?: { name: string; propFilters?: Filter[] };
  breakdown?: Dimension | `prop:${string}`;
  filters: Filter[];
  dateRange: DateRangePreset | { from: string; to: string };
  compare?: "previous_period" | "previous_year" | null;
  chart: "line" | "bar" | "stacked_bar" | "pie" | "table" | "number";
};
```
- Report builder UI with live preview; save, rename, duplicate, delete; pin to the site overview (custom dashboard row, drag-to-reorder).
- **Retention** report: weekly cohort grid by first-seen week (Product mode only; disabled with explanation in Private mode).
- Scheduled email digests (weekly/monthly) per user per site summarizing KPIs, top sources, top revenue sources, biggest movers.

### 8.6 Revenue attribution (F6)

Goal: tie **backend-verified** payments to the visitor and their source — never trust client-side revenue alone (client `rev` is accepted but flagged `source='tracker'` and excluded from "verified revenue" by default; toggle to include).

Linking mechanism (document in docs with copy-paste code):
1. Product mode: in the checkout flow, call `waypoint.getVisitorId()` and pass it as metadata (`metadata.waypoint_visitor_id` / `client_reference_id`) when creating the Stripe Checkout Session / Lemon Squeezy checkout `custom_data` / Polar checkout metadata / Paddle `custom_data`.
2. Fallbacks in order: identified `user_id` matched to customer email/external id via `identify`; customer email hash match against `identify` traits; else recorded as "unattributed revenue".
3. Private mode: pass the **session id** the tracker exposes for the current page session (`waypoint.getSessionId()` — add this to the API) which is valid for that day; document the limitation.

Integrations (research each provider's current docs for event names, signature verification, and payload fields):
- **Stripe:** two options — (a) user pastes a restricted API key and we create the webhook endpoint for them via API; (b) user manually adds our webhook URL and secret. Events: `checkout.session.completed`, `invoice.paid`, `charge.refunded`, `customer.subscription.created/updated/deleted`. Record new revenue, renewals (recurring, attributed to original first-touch), refunds (negative revenue).
- **Lemon Squeezy:** `order_created`, `subscription_payment_success`, `order_refunded`; HMAC signature.
- **Polar:** `order.paid`/`order.created`, `subscription.*`, refunds; Standard Webhooks signature.
- **Paddle Billing:** `transaction.completed`, `adjustment.*`; signature header verification.
- **Custom / any backend:** `POST /v1/server/revenue` with `{site_id, visitor_id|session_id|user_id, amount_minor, currency, order_id, kind: "new"|"renewal"|"refund", occurred_at}` + `node-sdk` helper.

Processing: webhook route verifies signature → inserts into `revenue_events_raw` (unique on provider_event_id for idempotency) → enqueues job → worker resolves visitor, converts currency to site currency (daily FX rates table, fetched from a free provider such as ECB; store both original and converted) → writes `type='revenue'` row to ClickHouse with first-touch and last-touch attribution fields copied from the visitor.

Revenue page:
- KPIs: Total revenue, New vs recurring, Refunds, Paying customers, Revenue per visitor, Conversion rate to purchase, Avg. order value, Avg. time from first visit to purchase, Avg. visits before purchase.
- Attribution model switch: **First touch / Last touch / Linear** (multi-touch over sessions, Product mode).
- Revenue by channel, referrer, UTM source/medium/campaign, entry page, landing page, country, device — each with visitors, customers, conversion rate, revenue, RPV.
- Recent payments table with link to visitor profile and the source that drove it.
- Connection health: last webhook received, failure count, "send test event" button.

### 8.7 Teams (F7)

- Org owner invites by email with role; invite emails via Resend; pending invites list with resend/revoke.
- Roles: **Owner** (billing, delete org, everything), **Admin** (sites, members except owner, integrations, API keys), **Member** (view all, create funnels/reports/goals/annotations), **Viewer** (read-only).
- Optional per-site access restriction for Member/Viewer.
- Public sharing: per-site toggle generating an unguessable share link (`/share/{token}`), optional password, choose which sections are visible (hide revenue by default). Embeddable iframe variant.
- Audit log page for admins.
- Transfer site between orgs; transfer org ownership.

### 8.8 MCP server + REST API (F2)

**REST API** (`/api/v1`, versioned, OpenAPI 3.1 spec generated from Zod via `zod-openapi`, published in docs):
- Auth: `Authorization: Bearer wp_sk_…` (org-scoped keys with scopes `read:analytics`, `write:events`, `read:visitors`, `manage:sites`).
- Endpoints: `GET /sites`, `GET /sites/{id}/stats` (aggregate metrics), `GET /sites/{id}/timeseries`, `GET /sites/{id}/breakdown?dimension=…`, `GET /sites/{id}/realtime`, `GET /sites/{id}/events`, `GET /sites/{id}/funnels`, `GET /sites/{id}/funnels/{fid}/results`, `GET /sites/{id}/revenue?attribution=first_touch&breakdown=channel`, `GET /sites/{id}/visitors`, `GET /sites/{id}/visitors/{vid}`, `GET /sites/{id}/export?dataset=…&format=csv`.
- Common query params: `from`, `to`, `period`, `filters` (JSON or `filters[dimension][op]=value`), `compare`, `limit`, `cursor`.
- Rate limits per key (headers `X-RateLimit-*`), consistent error envelope `{error:{code,message}}`.

**MCP server** (`apps/mcp`):
- Transport: Streamable HTTP at `https://mcp.waypoint.example/mcp`, authenticated with OAuth 2.1 per the current MCP authorization spec (research it) **and** API-key bearer as a simpler fallback; stdio mode via `npx @waypoint/mcp --api-key …`.
- Tools (thin wrappers over `packages/events` query functions — no duplicated SQL), each with precise JSON Schema and descriptions written for an LLM:
  - `list_sites`
  - `get_overview` (site, period, filters, compare) → KPIs + deltas
  - `get_timeseries` (metric, interval)
  - `get_breakdown` (dimension, metric, limit, filters)
  - `get_realtime`
  - `list_events` / `get_event_properties`
  - `run_funnel` (ad-hoc steps or saved funnel id)
  - `get_revenue_attribution` (model, breakdown)
  - `find_visitors` / `get_visitor_profile` (respect mode limits)
  - `list_goals`, `list_reports`, `run_report`
  - `compare_periods` (returns biggest movers by dimension)
- Resources: `site://{id}/summary` (last 30 days digest). Prompts: `weekly_review`, `why_did_traffic_drop`, `which_channels_make_money`.
- Results capped and summarized (top N + totals) to stay token-efficient; include units and the resolved date range in every response.
- Settings page `/app/[org]/settings/mcp` shows copy-paste config for Claude Desktop, Claude Code (`claude mcp add …`), Cursor, VS Code, plus a "Test connection" button.
- Additionally (nice-to-have, same milestone if time): an in-app **"Ask"** panel that uses the Anthropic API with these same tools to answer questions about the current site.

### 8.9 Imports (F9)

- UI: Settings → Imports → choose source → upload file(s) (direct-to-S3/R2 presigned upload, up to 2 GB) or API credentials where the source offers an export API → preview first 20 parsed rows and detected date range → choose to import into this site → confirm.
- Worker parses streaming (CSV/JSON), maps to our `events` schema with `source='import:<provider>'`, inserts in batches, updates progress (shown live in UI), is resumable and idempotent (deterministic event_id from provider row id/hash).
- Adapters (research each tool's actual export format first; write fixture files from their docs and test against them):
  - **Umami:** CSV/DB export (`website_event`, `session` tables) → pageviews/events with sessions and UTMs.
  - **Databuddy:** its export format → events.
  - **Vercel Analytics:** its export (often aggregated, not raw) → if only aggregates are available, import into a separate `imported_daily_aggregates` table and merge into dashboard totals for dates before tracking started, with an "imported" badge on those ranges.
- Guardrail: warn/handle overlap with already-collected native data (default: import only dates before the site's first native event).
- Delete an import (removes its rows by `source` + import id).

### 8.10 Export (F11)

- CSV export on every table and every report (respecting current filters/date range).
- Full raw export: Settings → "Export all data" → worker writes gzipped CSV/NDJSON to object storage, emails a signed link (expires 7 days).

### 8.11 Billing & plans (F12)

- Plans defined once in `packages/shared/plans.ts` (names, monthly/yearly Stripe price ids from env, `maxWebsites`, `monthlyEvents`, `teamMembers`, `dataRetentionMonths`, `features` flags like `revenue`, `mcp`, `api`, `imports`). Use placeholder tiers (e.g. Starter / Growth / Business) — confirm real prices with the product owner; do not invent final prices in UI copy without a `TODO(pricing)` marker.
- Signup → org gets `trialing` status with `trial_ends_at = now + 7 days`, full features, no card required. Trial banner with days left. Emails at day 5 and day 7. After expiry without payment: tracking continues for 14 days (data kept), dashboard locked behind upgrade screen.
- Stripe Checkout for upgrade, Customer Portal for changes/cancel/invoices, webhooks keep `subscriptions` + `organizations.plan` in sync (idempotent).
- Enforcement: website count at site creation; monthly events — soft limit email at 80 % and 100 %, grace to 120 %, then ingest returns `202` but drops (and UI shows banner). Never break the customer's website.
- Usage page: events this month vs limit, per-site breakdown, chart.

### 8.12 Onboarding & settings

- Onboarding: create org → add website (domain, timezone, currency, mode with explainer) → snippet with framework tabs (HTML, Next.js, React/Vite, Vue/Nuxt, Astro, WordPress, Webflow, Framer, Shopify, Google Tag Manager) → "Verify installation" polls for first event (and offers a server-side check fetching the homepage and detecting the script) → optional: connect revenue provider → optional: invite team → land on dashboard.
- Site settings: name, domain, allowed hostnames, timezone, currency, mode, excluded IPs/paths, query params to strip, bot filter level, "exclude my visits" link, public sharing, revenue connections, imports, danger zone (reset data, delete site — require typing domain).

### 8.13 Public demo (F13)

- `pnpm seed:demo` generates a realistic 12-month dataset for a fictional SaaS site: daily/weekly seasonality, ~15 channels with realistic shares, campaigns, AI-assistant referrals, a signup → onboarding → upgrade funnel with plausible drop-offs, custom events with properties, Stripe-style revenue with renewals and refunds, identified users. Deterministic (seeded RNG).
- A cron job appends synthetic live traffic so the demo's Live page is never empty.
- Demo is read-only; mutating actions show "Start a free trial to do this".

---

## 9. Security & privacy requirements

- Never persist raw IPs (ingest, logs, error tracking). Scrub IPs in Sentry `beforeSend`.
- Secrets (webhook secrets, provider API keys) encrypted at rest (AES-256-GCM with key from env/KMS).
- API keys shown once, stored as argon2id hash + prefix.
- CSRF protection on all cookie-authenticated mutations; strict CORS (ingest: `*` for `/e` only; app API: same-origin).
- Content Security Policy on the app; tracker works under customers' strict CSPs (document required `script-src`/`connect-src`).
- Webhook signature verification mandatory for every provider; reject replays (timestamp tolerance).
- Rate limits on auth endpoints; account lockout / captcha after failures.
- Data retention job deletes events older than the plan's retention.
- GDPR: DPA page, data deletion per visitor, org deletion purges ClickHouse + Postgres + object storage within 30 days.

---

## 10. Non-functional

- Ingest: ≥ 5,000 events/s per instance; p99 < 50 ms; horizontal scale; graceful shutdown flushes buffers.
- Dashboard queries p95 < 1.5 s on 100 M-row sites (verify with a load-test script `scripts/bench` that generates 100 M synthetic rows).
- Tracker < 3 KB gzip; no layout shift; no main-thread work > 5 ms.
- Accessibility: WCAG 2.1 AA — keyboard navigable, charts have table fallbacks, color-blind-safe palette.
- Observability: structured JSON logs (pino), OpenTelemetry traces, Sentry, `/metrics` Prometheus endpoint on ingest + worker.
- i18n-ready strings (English only at launch). All dates rendered in site timezone.

---

## 11. Testing requirements

- **Unit:** channel classifier (table of ≥ 60 referrer/UTM cases), UA parsing wrapper, bot filter, sessionization, visitor hash + salt rotation, plan enforcement, webhook signature verification per provider, import adapters (fixtures), currency conversion, filter → SQL compiler (incl. SQL-injection attempts in filter values — all values must be parameterized).
- **Integration (Testcontainers):** ingest → ClickHouse → query functions return expected numbers on a fixed fixture; funnel computation; revenue attribution end-to-end with a simulated Stripe webhook; authorization matrix (role × endpoint).
- **E2E (Playwright):** signup → trial → create site → install snippet on a fixture page served by the test → see live visitor → fire custom event → build funnel → simulate Stripe payment → revenue appears attributed to the right UTM source → invite member → viewer cannot edit → export CSV → MCP tool call returns same numbers as UI.
- **Tracker:** Playwright tests in a sample SPA verifying pageviews on route change, outbound/download tracking, beacon on unload, Private mode writes nothing to cookies/storage.
- CI (GitHub Actions): lint, typecheck, unit, integration, E2E, tracker size check (fail if > 3 KB gzip).

---

## 12. Developer experience deliverables

- `README.md`: architecture diagram, one-command local setup, env var table (`.env.example` with every variable documented), how to seed, how to run tests, how to deploy.
- `docs/ARCHITECTURE.md`: data flow (tracker → ingest → Redis/ClickHouse → web/API/MCP), sessionization, attribution logic, privacy model.
- `docs/KNOWN_GAPS.md` kept current.
- Example apps in `examples/` (plain HTML, Next.js) used by E2E tests and docs.

---

## 13. Out of scope (unless time remains)

Heatmaps, session replay, A/B testing, mobile SDKs, white-labeling, SSO/SAML.

---

## 14. Milestones (build in this order; each ends green and committed)

1. **Foundation** — monorepo, docker-compose, Postgres + ClickHouse schemas/migrations, auth (email/password + magic link + Google/GitHub), orgs/memberships, app shell with site switcher, CI.
2. **Collection** — tracker (Private + Product modes, auto pageviews, SPA, outbound, downloads, custom events, engagement pings), ingest service (validation, enrichment, bot filter, sessionization, batching), onboarding with install verification.
3. **Core dashboard** — KPI row, main chart, all panels, filters, comparisons, date ranges, CSV export, annotations, rollups + caching.
4. **Live activity** — Redis presence, SSE feed, live panels, map.
5. **Events, goals, visitors** — events explorer, goals, visitor list + profiles + timelines, identify/merge, GDPR delete/export.
6. **Funnels & reports** — funnel builder + results + breakdowns + drop-off drilldowns, report builder, pinned reports, retention, email digests.
7. **Revenue** — server SDK + custom revenue API, Stripe, Lemon Squeezy, Polar, Paddle integrations, FX conversion, attribution models, revenue page, revenue columns across dashboard tables.
8. **Teams & sharing** — invites, roles, per-site access, public share links + embed, audit log.
9. **API & MCP** — REST API + OpenAPI docs, API keys, MCP server (HTTP + stdio, OAuth + key), MCP settings page, optional in-app "Ask" panel.
10. **Imports & full export** — upload pipeline, Umami / Databuddy / Vercel adapters, progress UI, raw data export.
11. **Billing** — plans config, 7-day trial lifecycle, Stripe Checkout/Portal/webhooks, usage metering + limits + emails.
12. **Marketing, docs, demo** — landing, pricing, MDX docs, seeded public demo with synthetic live traffic.
13. **Hardening** — load tests vs. budgets in §10, security checklist in §9, accessibility pass, E2E suite complete, deploy docs.

## 15. Definition of done

- Every row in §1 is demonstrable in the seeded demo and covered by at least one E2E test.
- The same metric queried via UI, REST API, and MCP returns identical numbers for the same filters/range.
- Fresh clone → `pnpm i && docker compose up -d && pnpm db:migrate && pnpm seed:demo && pnpm dev` → working app with demo data in under 5 minutes.
- `docs/KNOWN_GAPS.md` lists anything not fully done, with reasons.
