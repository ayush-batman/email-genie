import Link from "next/link";
import { CodeBlock } from "./code-block.tsx";
import { IMPORT_PROVIDERS } from "@/lib/importers.ts";
import { TOOLS } from "@/lib/tools.ts";

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-10 mb-3 text-xl font-semibold tracking-tight">{children}</h2>;
const P = ({ children }: { children: React.ReactNode }) => <p className="my-3 leading-relaxed text-muted">{children}</p>;
const C = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-subtle px-1.5 py-0.5 text-[0.85em] text-fg">{children}</code>;
const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => (
  <div className="my-4 overflow-x-auto rounded-xl border border-line">
    <table className="table w-full min-w-[520px]"><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="align-top">{c}</td>)}</tr>)}</tbody></table>
  </div>
);

export type DocPage = { slug: string; title: string; section: string; description: string; body: (origin: string) => React.ReactNode };

export const DOCS: DocPage[] = [
  {
    slug: "getting-started", section: "Start", title: "Quick start", description: "Add Waypoint to your site in under a minute.",
    body: (o) => (
      <>
        <P>1. <Link className="text-accent" href="/signup">Create an account</Link> and add your website. You&apos;ll get a site id.</P>
        <P>2. Add the script to the <C>&lt;head&gt;</C> of every page:</P>
        <CodeBlock code={`<script defer src="${o}/w.js" data-site="YOUR_SITE_ID"></script>`} />
        <P>3. Open your site. Visits appear on the <b>Live</b> page within seconds, and your settings page confirms the installation automatically.</P>
        <H>Frameworks</H>
        <CodeBlock label="Next.js (app/layout.tsx)" code={`import Script from "next/script";\n\n<Script src="${o}/w.js" data-site="YOUR_SITE_ID" strategy="afterInteractive" />`} />
        <P>Single-page apps (React, Vue, Svelte, Astro view transitions) are tracked automatically: the script follows <C>history.pushState</C> and back/forward navigation. In WordPress, Webflow, Framer or Shopify, paste the snippet into the site-wide head/custom code setting. With Google Tag Manager, add it as a Custom HTML tag on All Pages.</P>
      </>
    ),
  },
  {
    slug: "script", section: "Start", title: "Script options", description: "Attributes that configure the tracking script.",
    body: () => (
      <>
        <P>The script is under 3 KB gzipped, loads with <C>defer</C>, and never throws on your page.</P>
        <Table head={["Attribute", "Default", "What it does"]} rows={[
          [<C key="a">data-site</C>, "required", "Your site id."],
          [<C key="a">data-mode</C>, "private", <>Set to <C>product</C> to remember returning visitors (see <Link className="text-accent" href="/docs/privacy">privacy modes</Link>).</>],
          [<C key="a">data-api</C>, "same origin as the script", "Send events to a different endpoint, for example through a proxy on your own domain to avoid ad blockers."],
          [<C key="a">data-auto-pageview</C>, "true", <>Set <C>false</C> to call <C>waypoint.pageview()</C> yourself.</>],
          [<C key="a">data-outbound</C>, "true", <>Track clicks on links to other domains as <C>outbound_click</C>.</>],
          [<C key="a">data-downloads</C>, "true", <>Track file downloads (pdf, zip, dmg, csv…) as <C>file_download</C>.</>],
          [<C key="a">data-hash</C>, "false", "Count #hash changes as pageviews (hash-based routers)."],
          [<C key="a">data-exclude</C>, "", <>Comma-separated paths to ignore, with <C>*</C> wildcards: <C>/admin/*,/preview/*</C>.</>],
          [<C key="a">data-allow-localhost</C>, "false", "Send events from localhost (off by default so development doesn't pollute data)."],
          [<C key="a">data-debug</C>, "false", "Log events to the console instead of sending them."],
        ]} />
        <H>Excluding your own visits</H>
        <P>Run <C>waypoint.optOut()</C> in your browser console on your site. Undo with <C>waypoint.optIn()</C>.</P>
      </>
    ),
  },
  {
    slug: "events", section: "Start", title: "Custom events", description: "Track signups, clicks and anything else that matters.",
    body: () => (
      <>
        <CodeBlock code={`// Name + optional properties (strings, numbers, booleans; up to 30)\nwaypoint.track("signup", { plan: "pro", method: "google" });\n\n// No JavaScript: any element with data-waypoint-event fires on click\n<button data-waypoint-event="cta_click" data-waypoint-prop-location="hero">Start</button>`} />
        <P>Event names are up to 64 characters of letters, numbers, spaces and <C>_ . : -</C>. Explore an event&apos;s properties from the dashboard: Events → Details → pick an event.</P>
        <H>Calling before the script loads</H>
        <CodeBlock code={`window.waypoint = window.waypoint || function () { (waypoint.q = waypoint.q || []).push(arguments) };\nwaypoint("track", "signup");`} />
        <H>JavaScript API</H>
        <Table head={["Call", "Description"]} rows={[
          [<C key="a">waypoint.track(name, props?)</C>, "Record a custom event."],
          [<C key="a">waypoint.pageview()</C>, "Record a pageview manually (with data-auto-pageview=\"false\")."],
          [<C key="a">waypoint.identify(userId)</C>, "Product mode: link this visitor to your user id, across devices."],
          [<C key="a">waypoint.getVisitorId()</C>, "Product mode: the visitor id to pass to checkout for revenue attribution."],
          [<C key="a">waypoint.reset()</C>, "Forget the visitor and user id (call on logout)."],
          [<C key="a">waypoint.optOut() / optIn()</C>, "Stop or resume tracking in this browser."],
        ]} />
      </>
    ),
  },
  {
    slug: "privacy", section: "Concepts", title: "Privacy modes", description: "What Waypoint stores, and the difference between Private and Product mode.",
    body: () => (
      <>
        <Table head={["", "Private (default)", "Product"]} rows={[
          ["Cookies / device storage", "None", "A random id in localStorage"],
          ["Visitor identity", "Anonymous hash, reset every day", "Stable across days and visits"],
          ["Returning visitors, retention", "Within a day", "Yes"],
          [<C key="a">identify()</C>, "Disabled", "Yes"],
          ["Revenue attribution", "Same-day only", "Yes"],
          ["Consent banner", "Usually not needed", "May be needed (GDPR/ePrivacy)"],
        ]} />
        <P>In Private mode the visitor id is <C>sha256(daily salt, site, IP, user agent)</C>. The salt is random, rotates at midnight UTC and the old one is deleted, so visits can&apos;t be linked across days, not even by us.</P>
        <H>What we never store</H>
        <P>IP addresses are used in memory to derive the anonymous id and are never written to disk or logs. Location comes from your CDN&apos;s country/city headers. We don&apos;t fingerprint browsers and don&apos;t use cookies in Private mode.</P>
        <P>Visitors&apos; data can be exported or erased from their profile page (Visitors → a visitor → Data rights).</P>
      </>
    ),
  },
  {
    slug: "revenue", section: "Concepts", title: "Revenue attribution", description: "Connect payments and see which sources make money.",
    body: (o) => (
      <>
        <P>Payments are verified server-side via your payment provider&apos;s signed webhooks, then matched to the visitor who paid. Use <b>Product mode</b> and pass the visitor id at checkout:</P>
        <CodeBlock code={`const visitorId = waypoint.getVisitorId();`} />
        <Table head={["Provider", "Where to pass it", "Webhook events"]} rows={[
          ["Stripe", <span key="a"><C>metadata.waypoint_visitor_id</C> (also in <C>subscription_data.metadata</C> for subscriptions), or <C>client_reference_id</C></span>, "checkout.session.completed, invoice.paid, charge.refunded"],
          ["Lemon Squeezy", <C key="a">checkout_data.custom.waypoint_visitor_id</C>, "order_created, order_refunded, subscription_payment_success"],
          ["Polar", <C key="a">metadata.waypoint_visitor_id</C>, "order.paid, order.refunded"],
          ["Paddle", <C key="a">customData.waypoint_visitor_id</C>, "transaction.completed, adjustment.created/updated"],
        ]} />
        <P>Set up each provider under <b>Site settings → Revenue</b>: it shows your webhook URL and stores the signing secret encrypted. Renewals and refunds without metadata are still attributed through the customer id seen on the first payment. Duplicate webhook deliveries are ignored.</P>
        <H>From your own backend</H>
        <CodeBlock code={`curl -X POST ${o}/api/v1/revenue \\\n  -H "Authorization: Bearer wp_sk_..." -H "Content-Type: application/json" \\\n  -d '{"site_id":"YOUR_SITE_ID","amount":4900,"currency":"USD","order_id":"ord_123","visitor_id":"..."}'`} />
        <P>Amounts are in minor units (cents). Identify the buyer with <C>visitor_id</C>, <C>user_id</C> (from <C>identify()</C>), <C>session_id</C> or a <C>customer_id</C>. <C>type</C> is <C>payment</C>, <C>renewal</C> or <C>refund</C>.</P>
        <H>Attribution models</H>
        <P><b>Last touch</b> credits the source of the visit in which the customer paid. <b>First touch</b> credits whatever first brought them to your site, even months earlier. Switch between them on the Revenue page.</P>
      </>
    ),
  },
  {
    slug: "funnels", section: "Concepts", title: "Funnels, goals & retention", description: "Measure conversion and find where people leave.",
    body: () => (
      <>
        <P><b>Goals</b> are a page path (exact, or a prefix ending in <C>*</C>) or a custom event name. Conversion rate = visitors who completed the goal ÷ all visitors.</P>
        <P><b>Funnels</b> are 2–10 ordered steps that must happen within a window (1 hour to 90 days). For each step you get visitors, conversion from the first and previous step, the median time between steps, a breakdown by source, country or device, and for each drop-off the people who left and the pages they went to instead.</P>
        <P><b>Retention</b> groups visitors by the week of their first visit and shows the share who came back in each following week. It needs Product mode.</P>
      </>
    ),
  },
  {
    slug: "api", section: "Integrate", title: "REST API", description: "Read your analytics from code.",
    body: (o) => (
      <>
        <P>Create a key in <b>Team & billing → API & MCP</b>. Keys are team-wide and read-only. The full spec is at <a className="text-accent" href="/api/v1/openapi.json">/api/v1/openapi.json</a>.</P>
        <CodeBlock code={`curl "${o}/api/v1/sites/YOUR_SITE_ID/breakdown?dimension=channel&period=30d" \\\n  -H "Authorization: Bearer wp_live_..."`} />
        <Table head={["Endpoint", "Description"]} rows={TOOLS.map((t) => [<C key="a">GET /api/v1{t.path}</C>, t.description])} />
        <P>Common parameters: <C>period</C> (today, 7d, 30d, 90d, month, last_month, ytd, 12mo, all), or <C>from</C>/<C>to</C> as YYYY-MM-DD, and <C>filters</C> as <C>dim:op:value</C> joined by <C>|</C>. Errors return <C>{"{ error: { code, message } }"}</C>.</P>
      </>
    ),
  },
  {
    slug: "mcp", section: "Integrate", title: "MCP & Ask", description: "Ask your analytics from Claude, Cursor and other AI tools.",
    body: (o) => (
      <>
        <P>Waypoint runs an MCP server at <C>{o}/api/mcp</C> (Streamable HTTP). Authenticate with a team API key.</P>
        <CodeBlock label="Claude Code" code={`claude mcp add --transport http waypoint ${o}/api/mcp \\\n  --header "Authorization: Bearer wp_live_..."`} />
        <CodeBlock label="Cursor (.cursor/mcp.json)" code={JSON.stringify({ mcpServers: { waypoint: { url: `${o}/api/mcp`, headers: { Authorization: "Bearer wp_live_..." } } } }, null, 2)} />
        <P>Tools: {TOOLS.map((t, i) => <span key={t.name}>{i > 0 && ", "}<C>{t.name}</C></span>)}. All read-only, returning the same numbers as the dashboard.</P>
        <H>Ask, inside the app</H>
        <P>The <b>Ask</b> button on every site page answers questions with the same tools. Self-hosted installs enable it by setting <C>ANTHROPIC_API_KEY</C>.</P>
      </>
    ),
  },
  {
    slug: "imports", section: "Integrate", title: "Imports & export", description: "Bring your history, take your data with you.",
    body: () => (
      <>
        <Table head={["Source", "Upload", "How to get it"]} rows={Object.values(IMPORT_PROVIDERS).map((p) => [p.name, p.files, p.help])} />
        <P>Imports run in the background from <b>Site settings → Import history</b>. By default only data from before Waypoint started tracking is imported, so nothing is counted twice. Each import can be removed later.</P>
        <H>Exporting</H>
        <P>Any dashboard table exports to CSV. <b>Site settings → Export all data</b> downloads every event as CSV or NDJSON.</P>
      </>
    ),
  },
  {
    slug: "team", section: "Integrate", title: "Team & sharing", description: "Roles, invitations and public dashboards.",
    body: () => (
      <>
        <Table head={["Role", "Can"]} rows={[
          ["Owner", "Everything, including billing"],
          ["Admin", "Manage websites, members, payment connections and API keys"],
          ["Member", "View everything; create funnels and goals"],
          ["Viewer", "Read-only dashboards"],
        ]} />
        <P>Invite people from <b>Team & billing → Team</b>. Invitations expire after 7 days. Sensitive changes are recorded in the audit log.</P>
        <P>A <b>public dashboard</b> link (Site settings → Public dashboard) shows a read-only dashboard to anyone with the link, without CSV export.</P>
      </>
    ),
  },
  {
    slug: "self-hosting", section: "Operate", title: "Self-hosting", description: "Run Waypoint on your own infrastructure, on one server or several.",
    body: () => (
      <>
        <P>Waypoint is one Next.js app backed by Postgres (accounts, settings), ClickHouse (events and a per-visit rollup) and Redis (shared visit state and rate limits).</P>
        <H>Production stack</H>
        <CodeBlock code={`cp .env.example .env            # set APP_SECRET, CRON_SECRET, APP_URL, …\ndocker compose -f docker-compose.prod.yml up -d --build\ndocker compose -f docker-compose.prod.yml run --rm app1 node --experimental-strip-types scripts/migrate.ts`} />
        <P>This runs nginx in front of two app replicas. Any replica can serve any request: visits and rate limits live in Redis, accounts in Postgres. Add replicas by adding services and listing them in <C>deploy/nginx.conf</C>. Each replica buffers incoming events for up to a second and writes them on shutdown, so give containers a stop grace period of a few seconds.</P>
        <H>Without Docker</H>
        <CodeBlock code={`docker compose up -d        # Postgres, ClickHouse, Redis for development\ncp .env.example .env.local\nnpm install && npm run migrate\nnpm run build && npm start`} />
        <Table head={["Variable", "Purpose"]} rows={[
          [<C key="a">DATABASE_URL</C>, "Postgres connection string"],
          [<C key="a">CLICKHOUSE_URL / _USER / _PASSWORD / _DB</C>, "ClickHouse connection"],
          [<C key="a">REDIS_URL</C>, "Required with more than one app instance; optional for a single one"],
          [<C key="a">APP_SECRET</C>, "32+ random characters; encrypts stored payment secrets"],
          [<C key="a">APP_URL</C>, "Public URL, used in emails and Stripe redirects"],
          [<C key="a">CRON_SECRET</C>, <>Protects <C>/api/cron/digests</C>; call it daily</>],
          [<C key="a">RESEND_API_KEY, EMAIL_FROM</C>, "Email delivery (logged to the console when unset)"],
          [<C key="a">STRIPE_*</C>, "Billing (optional)"],
          [<C key="a">ANTHROPIC_API_KEY</C>, "Enables the Ask assistant (optional)"],
        ]} />
        <P>Run behind a CDN that sets country headers (Cloudflare or Vercel) to get visitor locations.</P>
      </>
    ),
  },
];
