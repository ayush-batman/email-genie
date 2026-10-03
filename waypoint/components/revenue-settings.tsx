import { CheckCircle2, ChevronRight } from "lucide-react";
import { sql, type Site } from "@/lib/db.ts";
import { ago } from "@/lib/format.ts";
import { createRevenueApiKey, removeRevenueConnection, saveRevenueConnection } from "@/app/actions.ts";
import { ApiKeyButton, SecretForm } from "./revenue-forms.tsx";
import { CodeBlock } from "./code-block.tsx";

const PROVIDERS = [
  {
    id: "stripe", name: "Stripe", color: "#635bff", placeholder: "whsec_…",
    steps: ["Stripe Dashboard → Workbench → Webhooks → Create an event destination.", "Endpoint URL: the URL below.", "Events: checkout.session.completed, invoice.paid, charge.refunded.", "Reveal the signing secret (whsec_…) and paste it here."],
    meta: `// When creating the Checkout Session\nmetadata: { waypoint_visitor_id: visitorId },\nsubscription_data: { metadata: { waypoint_visitor_id: visitorId } }, // subscriptions`,
  },
  {
    id: "lemonsqueezy", name: "Lemon Squeezy", color: "#ffc233", placeholder: "Signing secret",
    steps: ["Settings → Webhooks → +", "Callback URL: the URL below, and choose a signing secret.", "Events: order_created, order_refunded, subscription_payment_success.", "Paste the same signing secret here."],
    meta: `// Checkout link or API\ncheckout_data: { custom: { waypoint_visitor_id: visitorId } }`,
  },
  {
    id: "polar", name: "Polar", color: "#0062ff", placeholder: "whsec_…",
    steps: ["Organization settings → Webhooks → Add endpoint (format: Raw).", "URL: the URL below.", "Events: order.paid, order.refunded.", "Copy the secret and paste it here."],
    meta: `// Checkout session\nmetadata: { waypoint_visitor_id: visitorId }`,
  },
  {
    id: "paddle", name: "Paddle", color: "#ffd700", placeholder: "pdl_ntfset_…",
    steps: ["Developer tools → Notifications → New destination (webhook).", "URL: the URL below.", "Events: transaction.completed, adjustment.created, adjustment.updated.", "Copy the secret key and paste it here."],
    meta: `// Paddle.js checkout\nPaddle.Checkout.open({ items, customData: { waypoint_visitor_id: visitorId } })`,
  },
] as const;

type Conn = { provider: string; last_event_at: Date | null };
type SectionT = (p: { title: string; description?: React.ReactNode; children: React.ReactNode }) => React.ReactNode;

export async function RevenueSettings({ site, origin, editable, Section }: { site: Site; origin: string; editable: boolean; Section: SectionT }) {
  const conns = await sql<Conn[]>`SELECT provider, last_event_at FROM revenue_connections WHERE site_id = ${site.id}`;
  const conn = (p: string) => conns.find((c) => c.provider === p);
  const api = conn("api");

  return (
    <div id="revenue" className="scroll-mt-6">
    <Section title="Revenue" description={<>Connect payments to see which sources make money. Payments are verified server-side and matched to visitors via <code>waypoint_visitor_id</code> metadata{site.mode === "private" ? " (requires Product mode for cross-day attribution)" : ""}.</>}>
      <div className="space-y-2">
        {PROVIDERS.map((p) => {
          const c = conn(p.id);
          const url = `${origin}/api/webhooks/${p.id}/${site.id}`;
          return (
            <details key={p.id} className="group rounded-xl border border-line bg-panel open:shadow-[var(--shadow)]">
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: p.color }}>{p.name[0]}</span>
                <span className="flex-1 font-medium">{p.name}</span>
                {c ? (
                  <span className="chip bg-good-soft text-good"><CheckCircle2 className="h-3.5 w-3.5" /> {c.last_event_at ? `Last event ${ago(c.last_event_at)}` : "Connected · waiting for events"}</span>
                ) : <span className="chip bg-subtle text-muted">Not connected</span>}
                <ChevronRight className="h-4 w-4 text-faint transition group-open:rotate-90" />
              </summary>
              <div className="border-t border-line px-4 py-4 text-sm">
                <ol className="list-decimal space-y-1 pl-5 text-muted">{p.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                <CodeBlock label="Webhook URL" code={url} />
                <CodeBlock label="Pass the visitor at checkout" code={`const visitorId = waypoint.getVisitorId();\n${p.meta}`} />
                {editable && <SecretForm action={saveRevenueConnection.bind(null, site.id, p.id)} connected={!!c} placeholder={p.placeholder} />}
                {editable && c && (
                  <form action={removeRevenueConnection.bind(null, site.id, p.id)} className="mt-2"><button className="text-xs text-muted hover:text-bad">Disconnect {p.name}</button></form>
                )}
              </div>
            </details>
          );
        })}
        <details className="group rounded-xl border border-line bg-panel open:shadow-[var(--shadow)]">
          <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-fg font-mono text-xs font-bold text-bg">{"{}"}</span>
            <span className="flex-1 font-medium">Any backend (API)</span>
            {api ? <span className="chip bg-good-soft text-good"><CheckCircle2 className="h-3.5 w-3.5" /> {api.last_event_at ? `Last event ${ago(api.last_event_at)}` : "Key created"}</span> : <span className="chip bg-subtle text-muted">No key</span>}
            <ChevronRight className="h-4 w-4 text-faint transition group-open:rotate-90" />
          </summary>
          <div className="border-t border-line px-4 py-4 text-sm">
            <p className="text-muted">Report payments from your server with <code>POST /api/v1/revenue</code>. Amounts are in minor units (cents). Identify the buyer with <code>visitor_id</code>, <code>user_id</code> (from <code>identify()</code>), <code>session_id</code> or a <code>customer_id</code> seen before.</p>
            <div className="mt-3">{editable ? <ApiKeyButton create={createRevenueApiKey.bind(null, site.id)} exists={!!api} siteId={site.public_id} origin={origin} /> : null}</div>
          </div>
        </details>
      </div>
    </Section>
    </div>
  );
}
