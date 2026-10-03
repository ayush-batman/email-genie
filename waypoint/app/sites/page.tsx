import Link from "next/link";
import { Globe, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth.ts";
import { chQuery, sql, type Site } from "@/lib/db.ts";
import { AppShell, Favicon, PageHeader } from "@/components/shell.tsx";
import { Sparkline } from "@/components/sparkline.tsx";

export const metadata = { title: "Websites" };

export default async function SitesPage() {
  const user = await requireUser();
  const sites = await sql<Site[]>`
    SELECT s.* FROM sites s JOIN memberships m ON m.org_id = s.org_id AND m.user_id = ${user.id} ORDER BY s.created_at`;
  const ids = sites.map((s) => s.id);
  const [daily, online] = ids.length
    ? await Promise.all([
        chQuery<{ site_id: string; d: string; v: string }>(
          `SELECT site_id, toDate(ts) AS d, uniqExact(visitor_id) AS v FROM events
           WHERE site_id IN {ids:Array(UUID)} AND ts >= today() - 13 GROUP BY site_id, d ORDER BY d`, { ids }),
        chQuery<{ site_id: string; n: string }>(
          `SELECT site_id, uniqExact(visitor_id) AS n FROM events WHERE site_id IN {ids:Array(UUID)} AND ts > now() - INTERVAL 5 MINUTE GROUP BY site_id`, { ids }),
      ])
    : [[], []];

  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10));
  const series = (id: string) => days.map((d) => Number(daily.find((r) => r.site_id === id && r.d === d)?.v ?? 0));

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <PageHeader title="Websites" description="Visitors over the last 14 days.">
          <Link href="/sites/new" className="btn"><Plus className="h-4 w-4" /> Add website</Link>
        </PageHeader>
        {sites.length === 0 ? (
          <div className="panel grid place-items-center px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent"><Globe className="h-6 w-6" /></span>
            <h2 className="mt-4 text-lg font-semibold">Connect your first website</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">Add one script tag and see visitors, sources and conversions within seconds.</p>
            <Link href="/sites/new" className="btn mt-5"><Plus className="h-4 w-4" /> Add website</Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((s) => {
              const v = series(s.id);
              const week = v.slice(7).reduce((a, b) => a + b, 0);
              const prev = v.slice(0, 7).reduce((a, b) => a + b, 0);
              const delta = prev ? (week - prev) / prev : null;
              const now = Number(online.find((o) => o.site_id === s.id)?.n ?? 0);
              return (
                <li key={s.id}>
                  <Link href={`/sites/${s.id}`} className="panel block p-5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-lg)]">
                    <div className="flex items-center gap-2.5">
                      <Favicon domain={s.domain} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="block truncate text-xs text-muted">{s.domain}</span>
                      </span>
                      <span className={`chip ${now ? "bg-good-soft text-good" : "bg-subtle text-muted"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${now ? "bg-good" : "bg-faint"}`} /> {now} online
                      </span>
                    </div>
                    <div className="mt-5 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-2xl font-semibold tabular-nums tracking-tight">{week.toLocaleString()}</p>
                        <p className="text-xs text-muted">
                          visitors, last 7 days
                          {delta !== null && <span className={delta >= 0 ? "text-good" : "text-bad"}> · {delta >= 0 ? "+" : ""}{Math.round(delta * 100)}%</span>}
                        </p>
                      </div>
                      <Sparkline values={v} className="h-10 w-28" />
                    </div>
                  </Link>
                </li>
              );
            })}
            <li>
              <Link href="/sites/new" className="grid h-full min-h-40 place-items-center rounded-[14px] border border-dashed border-line-strong text-sm text-muted transition hover:border-accent hover:text-accent">
                <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add website</span>
              </Link>
            </li>
          </ul>
        )}
      </main>
    </AppShell>
  );
}
