import { requireSite } from "@/lib/auth.ts";
import { resolvePeriod } from "@/lib/dates.ts";
import { breakdown, timeseries } from "@/lib/stats.ts";
import { countryName, flag } from "@/lib/format.ts";
import { LiveFeed } from "@/components/live-feed.tsx";
import { PageHeader } from "@/components/shell.tsx";

export const metadata = { title: "Live" };

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { site } = await requireSite((await params).id);
  const scope = { siteId: site.id, tz: site.timezone, range: resolvePeriod("realtime", site.timezone), filters: [], currency: site.currency };
  const [series, pages, sources, countries] = await Promise.all([timeseries(scope), breakdown(scope, "page", 6), breakdown(scope, "channel", 6), breakdown(scope, "country", 6)]);
  const max = Math.max(1, ...series.map((p) => p.pageviews));
  const total = series.reduce((a, p) => a + p.pageviews, 0);

  const side: [string, typeof pages, (v: string) => string][] = [
    ["Active pages", pages, (v) => v || "Unknown"],
    ["Sources", sources, (v) => v || "Direct / none"],
    ["Countries", countries, (v) => (v ? `${flag(v)}  ${countryName(v)}` : "Unknown")],
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <PageHeader title="Live" description="What's happening on your site right now. Updates every 2 seconds." />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          <section className="panel p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">Pageviews per minute</h2>
              <span className="text-xs text-muted"><b className="text-fg tabular-nums">{total}</b> in the last 30 minutes</span>
            </div>
            <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Pageviews per minute, last 30 minutes">
              {series.map((p) => (
                <div key={p.bucket} className="flex h-full flex-1 items-end" title={`${p.bucket.slice(11, 16)} · ${p.pageviews} pageviews`}>
                  <div className={`w-full rounded-t-[3px] ${p.pageviews ? "bg-accent" : "bg-subtle"}`} style={{ height: p.pageviews ? `${Math.max(6, (p.pageviews / max) * 100)}%` : "3px" }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-faint"><span>30 min ago</span><span>now</span></div>
          </section>
          <LiveFeed siteId={site.id} />
        </div>
        <aside className="space-y-5">
          {side.map(([title, rows, fmt]) => (
            <section key={title} className="panel p-5">
              <h2 className="mb-3 text-sm font-semibold">{title}</h2>
              {rows.length === 0 ? <p className="text-xs text-muted">Nothing in the last 30 minutes.</p> : (
                <ul className="space-y-2 text-sm">
                  {rows.map((r) => (
                    <li key={r.value} className="flex items-center justify-between gap-2">
                      <span className="truncate">{fmt(r.value)}</span>
                      <span className="chip bg-subtle tabular-nums">{r.visitors}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </aside>
      </div>
    </main>
  );
}
