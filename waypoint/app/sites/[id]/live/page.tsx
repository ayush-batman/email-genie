import { requireSite } from "@/lib/auth.ts";
import { resolvePeriod } from "@/lib/dates.ts";
import { breakdown, timeseries } from "@/lib/stats.ts";
import { LiveFeed } from "@/components/live-feed.tsx";

export const metadata = { title: "Live" };

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { site } = await requireSite((await params).id);
  const scope = { siteId: site.id, tz: site.timezone, range: resolvePeriod("realtime", site.timezone), filters: [] };
  const [series, pages, sources, countries] = await Promise.all([
    timeseries(scope),
    breakdown(scope, "page", 8),
    breakdown(scope, "channel", 8),
    breakdown(scope, "country", 8),
  ]);
  const max = Math.max(1, ...series.map((p) => p.pageviews));

  return (
    <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-medium">Pageviews per minute · last 30 minutes</h2>
          <div className="flex h-24 items-end gap-0.5" role="img" aria-label="Pageviews per minute">
            {series.map((p) => (
              <div key={p.bucket} className="flex-1 rounded-t bg-accent" style={{ height: `${(p.pageviews / max) * 100}%`, minHeight: p.pageviews ? 2 : 0 }} title={`${p.bucket.slice(11, 16)} · ${p.pageviews} pageviews`} />
            ))}
          </div>
        </section>
        <LiveFeed siteId={site.id} />
      </div>
      <aside className="space-y-4">
        {([["Active pages", pages], ["Sources", sources], ["Countries", countries]] as const).map(([title, rows]) => (
          <section key={title} className="panel p-4">
            <h2 className="mb-2 text-sm font-medium">{title}</h2>
            {rows.length === 0 ? <p className="text-xs text-muted">Nothing in the last 30 minutes.</p> : (
              <ul className="space-y-1 text-sm">
                {rows.map((r) => <li key={r.value} className="flex justify-between gap-2"><span className="truncate">{r.value || (title === "Sources" ? "Direct / none" : "Unknown")}</span><span className="tabular-nums text-muted">{r.visitors}</span></li>)}
              </ul>
            )}
          </section>
        ))}
      </aside>
    </main>
  );
}
