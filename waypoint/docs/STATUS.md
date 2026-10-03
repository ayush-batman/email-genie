# Status

Milestones refer to §14 of the build prompt.

## Done (M1–M4)

- Accounts: email/password signup and login (scrypt, httpOnly session cookie), org per signup with 7-day trial date, per-site authorization (other orgs get 404)
- Websites: create/edit (domain, timezone, Private/Product mode), install snippet, auto-refreshing "waiting for first event" check, public share link, delete (with domain confirmation)
- Tracker: auto pageviews and SPA routes, engaged-time pings, outbound and download clicks, `track`/`identify`/`getVisitorId`/`optOut`, declarative events, pre-load queue
- Collection: Zod validation, bot/prefetch filtering, UA parsing, geo from CDN headers, channel classification (incl. AI assistants), UTMs/click IDs, 30-minute sessions with the source pinned per session, ClickHouse async inserts
- Dashboard: 8 KPIs with previous-period deltas, time series (minute→month buckets, site timezone, previous-period overlay, table fallback), panels for sources, pages, entry/exit, locations, devices and events, click-to-filter plus a filter builder, date presets and custom range, expanded view with search and pagination, CSV export
- Live: online-now count, SSE event feed (pause, events-only), per-minute chart, active pages/sources/countries
- Landing page, public demo (`/share/demo`), deterministic 90-day demo seed

## Deliberate simplifications (`ponytail:` comments in code)

| What | Limit | Upgrade when |
|---|---|---|
| In-process session map | assumes a single app instance | >1 replica → Redis |
| Live feed polls ClickHouse every 2s per viewer | fine for tens of viewers | many concurrent viewers → Redis pub/sub |
| Regex UA parsing | major browsers/OSes only | long tail matters → ua-parser-js |
| Geo from CDN headers only | blank geo when not behind Cloudflare/Vercel | self-hosting → MaxMind GeoLite2 |
| No login rate limiting | — | before public launch |
| Revenue shown as USD | no FX conversion | M7 revenue work |

## Not built yet

M5 visitor profiles and goals · M6 funnels and reports · M7 revenue integrations (Stripe/LS/Polar/Paddle) · M8 team invites and roles UI · M9 REST API and MCP server · M10 imports and full export · M11 Stripe billing and limits · M12 docs site
