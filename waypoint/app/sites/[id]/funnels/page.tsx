import Link from "next/link";
import { Funnel as FunnelIcon, Plus, Repeat } from "lucide-react";
import { requireSite } from "@/lib/auth.ts";
import { sql } from "@/lib/db.ts";
import { resolvePeriod } from "@/lib/dates.ts";
import { retention, runFunnel, stepLabel, type Funnel } from "@/lib/funnels.ts";
import { compact, pct } from "@/lib/format.ts";
import { PageHeader } from "@/components/shell.tsx";

export const metadata = { title: "Funnels" };

export default async function FunnelsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { site, role } = await requireSite((await params).id);
  const tab = (await searchParams).tab === "retention" ? "retention" : "funnels";
  const base = `/sites/${site.id}/funnels`;
  const funnels = await sql<Funnel[]>`SELECT id, name, steps, window_hours FROM funnels WHERE site_id = ${site.id} ORDER BY created_at`;
  const scope = { siteId: site.id, tz: site.timezone, range: resolvePeriod("30d", site.timezone), filters: [], currency: site.currency };

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <PageHeader title={tab === "funnels" ? "Funnels" : "Retention"} description={tab === "funnels" ? "Find where people leave on the way to converting. Last 30 days." : "How many visitors come back in the weeks after their first visit."}>
        <div className="tabs">
          <Link href={base} aria-current={tab === "funnels"} className="tab">Funnels</Link>
          <Link href={`${base}?tab=retention`} aria-current={tab === "retention"} className="tab">Retention</Link>
        </div>
        {tab === "funnels" && role !== "viewer" && <Link href={`${base}/new`} className="btn"><Plus className="h-4 w-4" /> New funnel</Link>}
      </PageHeader>
      {tab === "funnels" ? <FunnelList funnels={funnels} scope={scope} base={base} canEdit={role !== "viewer"} /> : <Retention siteId={site.id} tz={site.timezone} privateMode={site.mode === "private"} />}
    </main>
  );
}

async function FunnelList({ funnels, scope, base, canEdit }: { funnels: Funnel[]; scope: Parameters<typeof runFunnel>[0]; base: string; canEdit: boolean }) {
  if (!funnels.length)
    return (
      <div className="panel grid place-items-center px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent"><FunnelIcon className="h-6 w-6" /></span>
        <p className="mt-4 font-medium">No funnels yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted">Pick the pages and events on the path to conversion, like pricing → signup → purchase, and see where people drop off.</p>
        {canEdit && <Link href={`${base}/new`} className="btn mt-5"><Plus className="h-4 w-4" /> Create a funnel</Link>}
      </div>
    );
  const results = await Promise.all(funnels.map((f) => runFunnel(scope, f)));
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {funnels.map((f, i) => {
        const r = results[i]!;
        const last = r.at(-1)!;
        return (
          <li key={f.id}>
            <Link href={`${base}/${f.id}`} className="panel block p-5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-lg)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{f.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{f.steps.map(stepLabel).join(" → ")}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold tabular-nums">{pct(last.ofFirst)}</p>
                  <p className="text-xs text-muted">{compact(last.visitors)} converted</p>
                </div>
              </div>
              <div className="mt-4 flex h-14 items-end gap-1.5">
                {r.map((s, j) => <div key={j} className="flex-1 rounded-t bg-accent" style={{ height: `${Math.max(4, s.ofFirst * 100)}%`, opacity: 1 - j * (0.5 / r.length) }} title={`${s.label}: ${compact(s.visitors)}`} />)}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

async function Retention({ siteId, tz, privateMode }: { siteId: string; tz: string; privateMode: boolean }) {
  if (privateMode)
    return (
      <div className="panel grid place-items-center px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-warn-soft text-warn"><Repeat className="h-6 w-6" /></span>
        <p className="mt-4 font-medium">Retention needs Product mode</p>
        <p className="mt-1 max-w-md text-sm text-muted">In Private mode visitors get a new anonymous id every day, so returning visitors can&apos;t be recognised. Switch to Product mode in settings to start measuring retention.</p>
      </div>
    );
  const cohorts = await retention(siteId, tz);
  const weeks = Math.max(0, ...cohorts.map((c) => c.retained.length));
  return (
    <div className="panel overflow-x-auto p-5">
      <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr className="text-muted">
            <th className="text-left font-medium">First visit week</th><th className="text-right font-medium">Visitors</th>
            {Array.from({ length: weeks }, (_, k) => <th key={k} className="font-medium">{k === 0 ? "Week 0" : `+${k}`}</th>)}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.week}>
              <td className="whitespace-nowrap pr-2 font-medium">{new Date(c.week + "T00:00").toLocaleDateString("en", { month: "short", day: "numeric" })}</td>
              <td className="pr-2 text-right tabular-nums text-muted">{compact(c.size)}</td>
              {Array.from({ length: weeks }, (_, k) => {
                const v = c.retained[k];
                if (v === undefined) return <td key={k} />;
                const share = c.size ? v / c.size : 0;
                const a = k === 0 ? 1 : Math.min(1, share * 4);
                return (
                  <td key={k} className="h-9 min-w-12 rounded-md text-center tabular-nums" style={{ background: `color-mix(in oklab, var(--accent) ${Math.round(a * 85)}%, var(--subtle))`, color: a > 0.5 ? "var(--accent-fg)" : "var(--fg)" }} title={`${v} of ${c.size}`}>
                    {k === 0 ? "100%" : pct(share)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {cohorts.length === 0 && <p className="py-10 text-center text-sm text-muted">Not enough history yet.</p>}
    </div>
  );
}
