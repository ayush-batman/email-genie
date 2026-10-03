import { headers } from "next/headers";
import { canEdit, requireSite } from "@/lib/auth.ts";
import { chQuery } from "@/lib/db.ts";
import { SiteForm } from "@/components/site-form.tsx";
import { AutoRefresh } from "@/components/auto-refresh.tsx";
import { deleteSite, toggleSharing, updateSite } from "../../../actions.ts";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { site, role } = await requireSite((await params).id);
  const welcome = (await searchParams).welcome === "1";
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const [last] = await chQuery<{ t: string; n: string }>(
    `SELECT toString(max(ts)) AS t, count() AS n FROM events WHERE site_id = {site:UUID}`, { site: site.id });
  const receiving = Number(last?.n ?? 0) > 0;
  const editable = canEdit(role);

  const snippet = `<script defer src="${origin}/w.js" data-site="${site.public_id}"${site.mode === "product" ? ` data-mode="product"` : ""}></script>`;
  const nextSnippet = `import Script from "next/script";\n\n// app/layout.tsx, inside <body>\n<Script defer src="${origin}/w.js" data-site="${site.public_id}"${site.mode === "product" ? ` data-mode="product"` : ""} strategy="afterInteractive" />`;
  const eventsSnippet = `// Custom event with properties\nwaypoint.track("signup", { plan: "pro" });\n\n// Or without JavaScript\n<button data-waypoint-event="cta_click" data-waypoint-prop-location="hero">Start</button>${site.mode === "product" ? `\n\n// Product mode: link visits to your user and pass the visitor id to checkout\nwaypoint.identify(user.id);\nconst visitorId = waypoint.getVisitorId();` : ""}`;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {!receiving && <AutoRefresh ms={3000} />}
      <section className="panel p-6">
        <h1 className="text-xl font-semibold">{welcome ? "Install the tracking script" : "Tracking code"}</h1>
        <p className="mt-1 text-sm text-muted">Paste this into the <code>&lt;head&gt;</code> of every page on {site.domain}. It's under 3 KB and sets no cookies.</p>
        <Code label="HTML">{snippet}</Code>
        <details className="mt-3"><summary className="cursor-pointer text-sm text-muted">Next.js</summary><Code label="Next.js">{nextSnippet}</Code></details>
        <details className="mt-2"><summary className="cursor-pointer text-sm text-muted">Custom events{site.mode === "product" ? " & identify" : ""}</summary><Code label="Events">{eventsSnippet}</Code></details>
        <div className={`mt-4 rounded-lg border p-3 text-sm ${receiving ? "border-good text-good" : "border-line text-muted"}`} role="status">
          {receiving ? `✓ Receiving data. Last event ${last!.t} UTC.` : "⏳ Waiting for the first event… this page updates automatically once your site sends data."}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="mb-4 font-semibold">General</h2>
        {editable ? <SiteForm action={updateSite.bind(null, site.id)} values={site} submit="Save changes" /> : <p className="text-sm text-muted">Only owners and admins can change settings.</p>}
      </section>

      <section className="panel p-6">
        <h2 className="font-semibold">Public dashboard</h2>
        <p className="mt-1 text-sm text-muted">Anyone with the link can view this site's dashboard (read-only, no CSV export).</p>
        {site.share_token && <Code label="Share link">{`${origin}/share/${site.share_token}`}</Code>}
        {editable && <form action={toggleSharing.bind(null, site.id)} className="mt-3"><button className="btn-ghost">{site.share_token ? "Disable public link" : "Create public link"}</button></form>}
      </section>

      {editable && (
        <section className="panel border-bad/40 p-6">
          <h2 className="font-semibold text-bad">Delete website</h2>
          <p className="mt-1 text-sm text-muted">Permanently deletes the site and all of its analytics data. Type <b>{site.domain}</b> to confirm.</p>
          <form action={deleteSite.bind(null, site.id)} className="mt-3 flex gap-2">
            <input name="confirm" className="input" required pattern={site.domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} aria-label="Confirm domain" />
            <button className="btn bg-bad">Delete</button>
          </form>
        </section>
      )}
    </main>
  );
}

function Code({ label, children }: { label: string; children: string }) {
  return (
    <pre aria-label={label} className="mt-3 overflow-x-auto rounded-lg bg-bg p-3 text-xs leading-relaxed"><code>{children}</code></pre>
  );
}
