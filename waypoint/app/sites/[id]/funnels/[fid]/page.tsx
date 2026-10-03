import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Pencil, Trash2, TrendingDown } from "lucide-react";
import { requireSite } from "@/lib/auth.ts";
import { sql } from "@/lib/db.ts";
import { resolvePeriod } from "@/lib/dates.ts";
import { breakdown } from "@/lib/stats.ts";
import { dropOff, funnelBreakdown, runFunnel, type Funnel } from "@/lib/funnels.ts";
import { DIMENSIONS, PERIOD_LABELS, PERIODS, type Dimension, type Period } from "@/lib/query.ts";
import { ago, chDate, compact, duration, pct } from "@/lib/format.ts";
import { visitorName } from "@/lib/names.ts";
import { PageHeader } from "@/components/shell.tsx";
import { VisitorAvatar } from "@/components/avatar.tsx";
import { FunnelBuilder } from "@/components/funnel-builder.tsx";
import { deleteFunnel, saveFunnel } from "../../../../actions.ts";

const BREAKDOWNS: Dimension[] = ["channel", "referrer", "utm_campaign", "country", "device", "browser"];

export default async function FunnelPage({ params, searchParams }: { params: Promise<{ id: string; fid: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id, fid } = await params;
  const { site, role } = await requireSite(id);
  if (!/^[0-9a-f-]{36}$/i.test(fid)) notFound();
  const [f] = await sql<Funnel[]>`SELECT id, name, steps, window_hours FROM funnels WHERE id = ${fid} AND site_id = ${site.id}`;
  if (!f) notFound();
  const sp = await searchParams;
  const base = `/sites/${site.id}/funnels/${f.id}`;

  if (sp.edit === "1" && role !== "viewer") {
    const scope = { siteId: site.id, tz: site.timezone, range: resolvePeriod("30d", site.timezone), filters: [] };
    const [pages, events] = await Promise.all([breakdown(scope, "page", 50), breakdown(scope, "event", 50)]);
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
        <Link href={base} className="text-sm text-muted hover:text-fg">← {f.name}</Link>
        <div className="mt-4"><PageHeader title="Edit funnel" /></div>
        <div className="panel p-6"><FunnelBuilder action={saveFunnel.bind(null, site.id, f.id)} pages={pages.map((p) => p.value)} events={events.map((e) => e.value)} initial={f} /></div>
      </main>
    );
  }

  const period = (PERIODS as readonly string[]).includes(sp.period ?? "") && !["custom", "realtime"].includes(sp.period!) ? (sp.period as Period) : "30d";
  const by = BREAKDOWNS.includes(sp.by as Dimension) ? (sp.by as Dimension) : "channel";
  const drop = Math.max(0, Math.min(f.steps.length - 1, Number(sp.drop) || 0));
  const scope = { siteId: site.id, tz: site.timezone, range: resolvePeriod(period, site.timezone), filters: [], currency: site.currency };
  const link = (p: Record<string, string>) => `${base}?${new URLSearchParams({ period, by, ...(drop ? { drop: String(drop) } : {}), ...p })}`;

  const [steps, rows, drilldown] = await Promise.all([runFunnel(scope, f), funnelBreakdown(scope, f, by), drop ? dropOff(scope, f, drop) : null]);
  const total = steps[0]?.visitors ?? 0;
  const last = steps.at(-1)!;
  const worst = steps.slice(1).reduce<(typeof steps)[number] | null>((w, s) => (!w || s.ofPrev < w.ofPrev ? s : w), null);
  const totalTime = steps.slice(1).reduce((a, s) => a + (s.medianSecs ?? 0), 0);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <Link href={`/sites/${site.id}/funnels`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" /> Funnels</Link>
      <div className="mt-4">
        <PageHeader title={f.name} description={`${f.steps.length} steps · must convert within ${f.window_hours >= 24 ? `${f.window_hours / 24} day${f.window_hours === 24 ? "" : "s"}` : `${f.window_hours} hour${f.window_hours === 1 ? "" : "s"}`}`}>
          <form className="flex gap-2">
            <input type="hidden" name="by" value={by} />
            <select name="period" defaultValue={period} className="input w-auto" aria-label="Date range">
              {PERIODS.filter((p) => p !== "realtime" && p !== "custom").map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
            </select>
            <button className="btn-ghost">Apply</button>
          </form>
          {role !== "viewer" && (
            <>
              <Link href={`${base}?edit=1`} className="btn-ghost"><Pencil className="h-4 w-4" /> Edit</Link>
              <form action={deleteFunnel.bind(null, site.id, f.id)}><button className="btn-ghost text-bad" aria-label="Delete funnel"><Trash2 className="h-4 w-4" /></button></form>
            </>
          )}
        </PageHeader>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Overall conversion", pct(last.ofFirst), `${compact(last.visitors)} of ${compact(total)} visitors`],
          ["Biggest drop-off", worst ? pct(1 - worst.ofPrev) : "—", worst ? `before “${worst.label}”` : ""],
          ["Median time to convert", totalTime ? duration(totalTime) : "—", "sum of median step times"],
        ].map(([k, v, sub]) => (
          <div key={k} className="panel p-5">
            <p className="text-xs font-medium text-muted">{k}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{v}</p>
            <p className="mt-1 truncate text-xs text-faint">{sub}</p>
          </div>
        ))}
      </section>

      <section className="panel mt-5 p-5">
        <h2 className="mb-5 text-[15px] font-semibold">Steps</h2>
        {total === 0 ? <p className="py-10 text-center text-sm text-muted">No visitors reached the first step in this period.</p> : (
          <ol className="space-y-1">
            {steps.map((s, i) => (
              <li key={i}>
                {i > 0 && (
                  <div className="flex items-center gap-3 py-1.5 pl-11 text-xs">
                    <Link href={link({ drop: String(i) })} scroll={false} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 ${drop === i ? "bg-bad-soft text-bad" : "text-muted hover:bg-subtle hover:text-bad"}`}>
                      <TrendingDown className="h-3.5 w-3.5" /> {compact(s.dropped)} dropped ({pct(1 - s.ofPrev)})
                    </Link>
                    {s.medianSecs !== null && <span className="inline-flex items-center gap-1 text-faint"><Clock className="h-3.5 w-3.5" /> median {duration(s.medianSecs)}</span>}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{s.label}</span>
                      <span className="shrink-0 tabular-nums"><b>{compact(s.visitors)}</b> <span className="text-muted">· {pct(s.ofFirst)}</span></span>
                    </div>
                    <div className="h-8 overflow-hidden rounded-lg bg-subtle">
                      <div className="h-full rounded-lg bg-accent transition-all" style={{ width: `${Math.max(0.5, s.ofFirst * 100)}%`, opacity: 1 - i * (0.45 / steps.length) }} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {drilldown && (
        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="panel p-5">
            <h2 className="text-[15px] font-semibold">Dropped before “{steps[drop]!.label}”</h2>
            <p className="mt-1 text-xs text-muted">Most recent visitors who completed step {drop} but not step {drop + 1}.</p>
            {drilldown.visitors.length === 0 ? <p className="py-8 text-center text-sm text-muted">Nobody dropped here.</p> : (
              <ul className="mt-3 divide-y divide-line">
                {drilldown.visitors.slice(0, 10).map((v) => (
                  <li key={v.visitor_id}>
                    <Link href={`/sites/${site.id}/visitors/${encodeURIComponent(v.visitor_id)}`} className="flex items-center gap-3 py-2 text-sm hover:underline">
                      <VisitorAvatar id={v.visitor_id} size={28} />
                      <span className="flex-1 truncate">{visitorName(v.visitor_id)}</span>
                      <span className="text-xs text-faint">{ago(chDate(v.at))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="panel p-5">
            <h2 className="text-[15px] font-semibold">Where they went instead</h2>
            <p className="mt-1 text-xs text-muted">Pages these visitors viewed after step {drop}.</p>
            {drilldown.nextPages.length === 0 ? <p className="py-8 text-center text-sm text-muted">They left the site.</p> : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {drilldown.nextPages.map((p) => {
                  const max = drilldown.nextPages[0]!.visitors;
                  return (
                    <li key={p.path} className="relative flex justify-between rounded-md px-2 py-1">
                      <span className="absolute inset-y-0 left-0 rounded-md bg-bar" style={{ width: `${(p.visitors / max) * 100}%` }} />
                      <span className="relative truncate">{p.path}</span>
                      <span className="relative tabular-nums text-muted">{compact(p.visitors)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="panel mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
          <h2 className="mr-auto text-[15px] font-semibold">Conversion by {DIMENSIONS[by].label.toLowerCase()}</h2>
          <div className="tabs max-w-full overflow-x-auto">
            {BREAKDOWNS.map((d) => <Link key={d} href={link({ by: d })} scroll={false} aria-current={by === d} className="tab">{d === "utm_campaign" ? "Campaign" : DIMENSIONS[d].label}</Link>)}
          </div>
        </div>
        {rows.length === 0 ? <p className="py-10 text-center text-sm text-muted">No data.</p> : (
          <table className="table w-full">
            <thead><tr><th>{DIMENSIONS[by].label}</th><th className="text-right!">Started</th><th className="text-right!">Converted</th><th className="w-1/3 text-right!">Conversion</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.value}>
                  <td className="font-medium">{r.value || (by === "channel" || by === "referrer" || by === "utm_campaign" ? "Direct / none" : "Unknown")}</td>
                  <td className="text-right tabular-nums text-muted">{compact(r.started)}</td>
                  <td className="text-right tabular-nums">{compact(r.completed)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-3">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (r.rate / Math.max(0.0001, ...rows.map((x) => x.rate))) * 100)}%` }} /></div>
                      <span className="w-12 text-right font-semibold tabular-nums">{pct(r.rate)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
