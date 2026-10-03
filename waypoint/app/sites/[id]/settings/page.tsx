import { headers } from "next/headers";
import { CheckCircle2, Link2, Loader2, Trash2 } from "lucide-react";
import { canEdit, requireSite } from "@/lib/auth.ts";
import { chQuery } from "@/lib/db.ts";
import { ago, chDate } from "@/lib/format.ts";
import { SiteForm } from "@/components/site-form.tsx";
import { AutoRefresh } from "@/components/auto-refresh.tsx";
import { CodeBlock } from "@/components/code-block.tsx";
import { Tabs } from "@/components/tabs-client.tsx";
import { PageHeader } from "@/components/shell.tsx";
import { RevenueSettings } from "@/components/revenue-settings.tsx";
import { deleteImportAction, deleteSite, setDigest, toggleSharing, updateSite } from "../../../actions.ts";
import { ImportForm } from "@/components/import-form.tsx";
import { IMPORT_PROVIDERS } from "@/lib/importers.ts";
import { Download } from "lucide-react";
import { sql } from "@/lib/db.ts";

export const metadata = { title: "Settings" };

function Section({ title, description, children, danger }: { title: string; description?: React.ReactNode; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`panel grid gap-6 p-6 md:grid-cols-[240px_1fr] ${danger ? "border-bad/30" : ""}`}>
      <div>
        <h2 className={`font-semibold ${danger ? "text-bad" : ""}`}>{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { site, role, user } = await requireSite((await params).id);
  const [digest] = await sql<{ frequency: string }[]>`SELECT frequency FROM email_reports WHERE site_id = ${site.id} AND user_id = ${user.id}`;
  const welcome = (await searchParams).welcome === "1";
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const [last] = await chQuery<{ t: string; n: string }>(`SELECT toString(max(ts)) AS t, count() AS n FROM events WHERE site_id = {site:UUID}`, { site: site.id });
  const receiving = Number(last?.n ?? 0) > 0;
  // An import runs on the instance that started it; if that instance restarted, mark it so the user can retry.
  await sql`UPDATE imports SET status = 'failed', error = 'Interrupted by a server restart. Remove it and import again.'
            WHERE site_id = ${site.id} AND status = 'running' AND created_at < now() - interval '1 hour'`;
  const imports = await sql<{ id: string; provider: string; status: string; files: string; rows_total: number; rows_imported: number; rows_skipped: number; date_from: Date | null; date_to: Date | null; error: string | null; created_at: Date }[]>`
    SELECT * FROM imports WHERE site_id = ${site.id} ORDER BY created_at DESC LIMIT 20`;
  const importing = imports.some((i) => i.status === "running");
  const editable = canEdit(role);
  const modeAttr = site.mode === "product" ? ` data-mode="product"` : "";

  const html = `<script defer src="${origin}/w.js" data-site="${site.public_id}"${modeAttr}></script>`;
  const next = `// app/layout.tsx\nimport Script from "next/script";\n\n<Script src="${origin}/w.js" data-site="${site.public_id}"${modeAttr} strategy="afterInteractive" />`;
  const gtm = `<!-- Google Tag Manager → New tag → Custom HTML, trigger: All Pages -->\n${html}`;
  const events = `// Track any action, with optional properties\nwaypoint.track("signup", { plan: "pro" });\n\n// Or declaratively, no JavaScript needed\n<button data-waypoint-event="cta_click" data-waypoint-prop-location="hero">Start</button>`;
  const identify = `// After login: link this visitor to your user\nwaypoint.identify(user.id);\n\n// At checkout: pass the visitor id so payments are attributed\nconst visitorId = waypoint.getVisitorId();\n// Stripe: metadata: { waypoint_visitor_id: visitorId }`;

  return (
    <main className="mx-auto max-w-[1100px] space-y-5 px-4 py-6 sm:px-8">
      {(!receiving || importing) && <AutoRefresh ms={3000} />}
      <PageHeader title={welcome ? `Install Waypoint on ${site.domain}` : "Settings"} description={welcome ? "Add the snippet, then open your site. This page updates as soon as the first visit arrives." : site.domain} />

      <Section title="Tracking code" description={<>Add to the <code>&lt;head&gt;</code> of every page. Under 3 KB{site.mode === "private" ? ", no cookies" : ""}.</>}>
        <Tabs items={[
          { label: "HTML", content: <CodeBlock code={html} /> },
          { label: "Next.js", content: <CodeBlock code={next} /> },
          { label: "Tag Manager", content: <CodeBlock code={gtm} /> },
          { label: "Custom events", content: <CodeBlock code={events} /> },
          ...(site.mode === "product" ? [{ label: "Identify & checkout", content: <CodeBlock code={identify} /> }] : []),
        ]} />
        <div className={`mt-4 flex items-center gap-3 rounded-xl border p-4 text-sm ${receiving ? "border-good/30 bg-good-soft" : "border-line bg-subtle"}`} role="status">
          {receiving
            ? <><CheckCircle2 className="h-5 w-5 text-good" /><span><b className="text-good">Receiving data.</b> <span className="text-muted">Last event {ago(chDate(last!.t))}.</span></span></>
            : <><Loader2 className="h-5 w-5 animate-spin text-muted" /><span><b>Waiting for the first event…</b> <span className="text-muted">Visit {site.domain} after installing.</span></span></>}
        </div>
      </Section>

      <Section title="General" description="Name, domain, reporting timezone and how visitors are identified.">
        {editable ? <SiteForm action={updateSite.bind(null, site.id)} values={site} submit="Save changes" /> : <p className="text-sm text-muted">Only owners and admins can change settings.</p>}
      </Section>

      <RevenueSettings site={site} origin={origin} editable={editable} Section={Section} />

      <Section title="Email reports" description={<>A summary of visitors, revenue, top sources and pages, sent to {user.email}.</>}>
        <form action={setDigest.bind(null, site.id)} className="flex flex-wrap items-center gap-2">
          <select name="frequency" defaultValue={digest?.frequency ?? "off"} className="input w-48" aria-label="Report frequency">
            <option value="off">Off</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
          </select>
          <button className="btn-ghost">Save</button>
          {digest && <span className="chip bg-good-soft text-good">{digest.frequency === "weekly" ? "Every Monday" : "Monthly"}</span>}
        </form>
      </Section>

      <Section title="Public dashboard" description="A read-only link for investors, clients or your community. CSV export is disabled on shared links.">
        {site.share_token ? <CodeBlock code={`${origin}/share/${site.share_token}`} /> : <p className="text-sm text-muted">Sharing is off.</p>}
        {editable && (
          <form action={toggleSharing.bind(null, site.id)} className="mt-3">
            <button className="btn-ghost"><Link2 className="h-4 w-4" /> {site.share_token ? "Disable public link" : "Create public link"}</button>
          </form>
        )}
      </Section>

      <Section title="Import history" description="Bring your existing data from Umami, Databuddy or Vercel Analytics. Imported visits appear in every report.">
        {editable ? <ImportForm siteId={site.id} providers={Object.entries(IMPORT_PROVIDERS).map(([id, p]) => ({ id, ...p }))} /> : <p className="text-sm text-muted">Only owners and admins can import data.</p>}
        {imports.length > 0 && (
          <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
            {imports.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className={`chip ${i.status === "done" ? "bg-good-soft text-good" : i.status === "failed" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"}`}>{i.status === "running" ? "Importing…" : i.status}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{IMPORT_PROVIDERS[i.provider as keyof typeof IMPORT_PROVIDERS]?.name ?? i.provider} · <span className="font-normal text-muted">{i.files}</span></p>
                  <p className="text-xs text-muted">
                    {i.error ? i.error : <>{i.rows_imported.toLocaleString()} of {(i.rows_total - i.rows_skipped).toLocaleString()} events{i.rows_skipped ? ` · ${i.rows_skipped.toLocaleString()} skipped (overlap)` : ""}{i.date_from && ` · ${i.date_from.toISOString().slice(0, 10)} → ${i.date_to?.toISOString().slice(0, 10)}`}</>}
                  </p>
                  {i.status === "running" && i.rows_total > 0 && <div className="mt-1.5 h-1 max-w-xs overflow-hidden rounded-full bg-subtle"><div className="h-full bg-accent" style={{ width: `${(i.rows_imported / Math.max(1, i.rows_total - i.rows_skipped)) * 100}%` }} /></div>}
                </div>
                {editable && i.status !== "running" && <form action={deleteImportAction.bind(null, site.id, i.id)}><button className="text-xs text-muted hover:text-bad">Remove data</button></form>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Export all data" description="Every event Waypoint has stored for this site. IP addresses are never stored, so they're never exported.">
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost" href={`/api/sites/${site.id}/export/raw?format=csv`}><Download className="h-4 w-4" /> Download CSV</a>
          <a className="btn-ghost" href={`/api/sites/${site.id}/export/raw?format=ndjson`}><Download className="h-4 w-4" /> Download NDJSON</a>
        </div>
      </Section>

      {editable && (
        <Section title="Delete website" description="Permanently deletes this website and all of its data." danger>
          <form action={deleteSite.bind(null, site.id)} className="space-y-3">
            <label className="label" htmlFor="confirm">Type <b>{site.domain}</b> to confirm</label>
            <div className="flex gap-2">
              <input id="confirm" name="confirm" className="input" required pattern={site.domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} />
              <button className="btn btn-danger"><Trash2 className="h-4 w-4" /> Delete</button>
            </div>
          </form>
        </Section>
      )}
    </main>
  );
}
