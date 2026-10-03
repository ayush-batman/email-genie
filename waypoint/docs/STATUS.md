# Status

All milestones from the build prompt (§14) are implemented. This file records what was verified and the deliberate limits.

## Verified

- **Unit tests** (`npm test`, 18): channel classification, UA/bot parsing, sessionization, timezone ranges, filters, webhook signatures for all four providers, payload parsing, CSV parser, import mappers, plan rules, rate limits.
- **End-to-end** (`npm run e2e`, 8 browser tests):
  - tracker → dashboard → CSV in Private mode (no cookies or storage)
  - cross-team 404s
  - signed revenue webhook with replay and bad-signature rejection
  - REST and MCP numbers match the dashboard
  - funnels with drill-down and validation
  - Umami import and removal
  - one-time password reset
  - no page errors
- **Also exercised** (scripts in the build session, not yet in the suite):
  - invites (viewer limits, reused link rejected, removal)
  - API keys and the official MCP SDK client
  - Stripe Checkout, Portal and webhooks against a local stub
  - plan limits and paywalls
  - digests and reminder emails
  - the Ask loop against a stub Messages API
  - Vercel imports and raw export
  - login rate limiting and security headers
  - mobile layouts and dark mode
- **Performance** (10M synthetic events over 90 days, 4 shared cores, app + database + load generator on one machine):

  | Dashboard (all queries for one page load) | Before rollup | Now |
  |---|---|---|
  | 30 days (3.3M events), cold | 2.2 s | 0.65 s |
  | 30 days, filtered by a visit-level dimension | — | 0.47 s |
  | 30 days, filtered by page (raw-events path) | — | 0.90 s |
  | 90 days (10M events), cold | 3.4 s | 1.7 s |

  Visit metrics from the rollup match the raw-events path exactly (checked on the demo data). Ingest: ~660 req/s for one instance, ~980 req/s for two behind a load balancer on the same 4 cores. Tracker: 2.4 KB gzipped.
- **Multiple instances**, two instances behind a round-robin load balancer:
  - Without Redis, one visitor's pageviews split into 2 visits and half lost their source.
  - With Redis: 1 visit, correct source.
  - Login rate limits hold across instances.
  - The full e2e suite passes through the load balancer.
  - CI runs e2e this way.

## Not verified

- **Real Claude responses in Ask:** no Anthropic key was available. The request shape and tool loop were tested against a stub.
- **Live Stripe and payment-provider webhooks:** tested with correctly signed payloads, not real deliveries.
- **Real email delivery:** emails were logged, not sent through Resend.
- **The Docker image build:** the sandbox couldn't pull base images (Docker Hub rate limit) or reach npm from inside builds. The standalone server it packages was run and checked directly.

## Deliberate simplifications (search the code for `ponytail:`)

| What | Limit | Upgrade when |
|---|---|---|
| Ingest buffer per instance (flushed every second and on SIGTERM) | A hard crash loses up to ~1 s of that instance's events | Zero-loss needed → a queue (Kafka/Redis Streams) |
| Ingest inside Next.js | ~660 req/s per instance; add instances to scale | Very high traffic → standalone ingest service |
| Per-instance caches (site lookup 60 s, plan usage 5 min, finished date ranges 10 min) | Settings/plan changes take up to that long to reach every instance | — |
| Page/title/event panels and page filters read raw events | The slowest part of a 10M-event dashboard | → a per-page daily rollup |
| Imports run on the instance that started them | A restart interrupts the import (it's marked so you can retry) | Big or many imports → job queue |
| `uniq()` distinct counts | Exact up to 65k values, about 1% error above | Exact counts needed at scale |
| Live feed polls ClickHouse every 2 s per viewer | Fine for tens of open dashboards | Many concurrent viewers → Redis pub/sub |
| Regex UA parsing; geo from CDN headers only | Long-tail browsers; no geo without Cloudflare/Vercel | → ua-parser-js; MaxMind GeoLite2 |
| Imports run in-process from memory | 100 MB per upload | Bigger histories → object storage + worker |
| No FX conversion | Other currencies listed separately on the revenue page | Multi-currency customers |
| Funnel matching is greedy from the first step-1 hit | Can undercount when a later attempt would complete | → `windowFunnel()` |
| Plan prices are placeholders (`TODO(pricing)` in `lib/plans.ts`) | — | Before launch |

## Not built

Email verification on signup, owner transfer, per-site member restrictions, data-retention deletion jobs, OAuth for the MCP server (it uses API keys), heatmaps and session replay (out of scope in the spec).
