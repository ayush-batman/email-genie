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
- **Performance** (`npm run bench`, 10M events, 3.3M in a 30-day window, 4 shared cores):

  | Measurement | Result |
  |---|---|
  | Full dashboard queries, cold | ~2.2 s |
  | Full dashboard queries, warm | ~1.5 s |
  | Single query | 0.2–0.8 s |
  | Ingest throughput | ~660 req/s per instance (the bare framework does ~1,200 req/s on the same box) |
  | Tracker size | 2.4 KB gzipped |

## Not verified

- **Real Claude responses in Ask:** no Anthropic key was available. The request shape and tool loop were tested against a stub.
- **Live Stripe and payment-provider webhooks:** tested with correctly signed payloads, not real deliveries.
- **Real email delivery:** emails were logged, not sent through Resend.

## Deliberate simplifications (search the code for `ponytail:`)

| What | Limit | Upgrade when |
|---|---|---|
| In-process session map, rate limits, usage cache, ingest buffer | Single app instance; up to ~1 s of events lost on a crash | Running more than one replica → Redis/queue |
| Ingest inside Next.js | ~660 req/s per instance | Sustained high traffic → standalone ingest service |
| Dashboard on raw events (+10-minute cache for finished ranges) | ~2 s cold on 10M-event sites with 4 cores | 100M+ event sites → session rollup materialized view |
| `uniq()` distinct counts | Exact up to 65k values, about 1% error above | Exact counts needed at scale |
| Live feed polls ClickHouse every 2 s per viewer | Fine for tens of open dashboards | Many concurrent viewers → pub/sub |
| Regex UA parsing; geo from CDN headers only | Long-tail browsers; no geo without Cloudflare/Vercel | → ua-parser-js; MaxMind GeoLite2 |
| Imports run in-process from memory | 100 MB per upload | Bigger histories → object storage + worker |
| No FX conversion | Other currencies listed separately on the revenue page | Multi-currency customers |
| Funnel matching is greedy from the first step-1 hit | Can undercount when a later attempt would complete | → `windowFunnel()` |
| Plan prices are placeholders (`TODO(pricing)` in `lib/plans.ts`) | — | Before launch |

## Not built

Email verification on signup, owner transfer, per-site member restrictions, data-retention deletion jobs, OAuth for the MCP server (it uses API keys), heatmaps and session replay (out of scope in the spec).
