import Link from "next/link";
import { EyeOff, Search, Users } from "lucide-react";
import { requireSite } from "@/lib/auth.ts";
import { resolvePeriod } from "@/lib/dates.ts";
import { PERIOD_LABELS, PERIODS, type Period } from "@/lib/query.ts";
import { listVisitors } from "@/lib/visitors.ts";
import { visitorName } from "@/lib/names.ts";
import { ago, chDate, compact, countryName, flag, money } from "@/lib/format.ts";
import { PageHeader } from "@/components/shell.tsx";
import { VisitorAvatar } from "@/components/avatar.tsx";

export const metadata = { title: "Visitors" };
const PAGE = 50;

export default async function VisitorsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { site } = await requireSite((await params).id);
  const sp = await searchParams;
  const period = (PERIODS as readonly string[]).includes(sp.period ?? "") && sp.period !== "custom" ? (sp.period as Period) : "30d";
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim() ?? "";
  const scope = { siteId: site.id, tz: site.timezone, range: resolvePeriod(period, site.timezone), filters: [], currency: site.currency };
  const rows = await listVisitors(scope, { search: q, limit: PAGE + 1, offset: (page - 1) * PAGE });
  const base = `/sites/${site.id}/visitors`;
  const link = (p: Record<string, string>) => `${base}?${new URLSearchParams({ ...(period !== "30d" && { period }), ...(q && { q }), ...p })}`;

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <PageHeader title="Visitors" description="Everyone who visited, newest activity first. Click a visitor to see their full journey.">
        <form className="flex gap-2">
          <select name="period" defaultValue={period} className="input w-auto" aria-label="Date range">
            {PERIODS.filter((p) => p !== "realtime" && p !== "custom").map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-faint" />
            <input name="q" defaultValue={q} placeholder="Search user ID" className="input w-52 pl-8" aria-label="Search user ID" />
          </div>
          <button className="btn-ghost">Apply</button>
        </form>
      </PageHeader>

      {site.mode === "private" && (
        <div className="mb-5 flex gap-3 rounded-xl border border-warn/30 bg-warn-soft p-4 text-sm">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <p><b>Private mode:</b> visitors are anonymous and reset every day, so a returning visitor shows up as someone new tomorrow. Switch to Product mode in <Link href={`/sites/${site.id}/settings`} className="underline">settings</Link> for cross-day profiles and <code>identify()</code>.</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="panel grid place-items-center py-16 text-center">
          <Users className="h-7 w-7 text-faint" />
          <p className="mt-3 font-medium">{q ? "No visitors match that search" : "No visitors in this period"}</p>
          <p className="mt-1 text-sm text-muted">{q ? "Search matches identified user IDs and visitor IDs." : "Once your script sends data, visitors appear here."}</p>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table w-full min-w-[760px]">
            <thead>
              <tr><th>Visitor</th><th>First source</th><th>Location</th><th>Device</th><th className="text-right!">Visits</th><th className="text-right!">Pageviews</th><th className="text-right!">Revenue</th><th className="text-right!">Last seen</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, PAGE).map((v) => (
                <tr key={v.visitor_id} className="cursor-pointer">
                  <td>
                    <Link href={`${base}/${encodeURIComponent(v.visitor_id)}`} className="flex items-center gap-3 after:absolute after:inset-0 relative">
                      <VisitorAvatar id={v.visitor_id} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{v.user_id || visitorName(v.visitor_id)}</span>
                        <span className="block text-xs text-muted">{v.user_id ? visitorName(v.visitor_id) : "Anonymous"} · first seen {ago(chDate(v.first_seen))}</span>
                      </span>
                    </Link>
                  </td>
                  <td><span className="text-sm">{v.referrer_domain || v.channel}</span>{v.referrer_domain && <span className="block text-xs text-muted">{v.channel}</span>}</td>
                  <td className="whitespace-nowrap">{v.country ? <>{flag(v.country)} {countryName(v.country)}</> : <span className="text-muted">Unknown</span>}</td>
                  <td className="capitalize">{v.device}<span className="block text-xs text-muted normal-case">{v.browser}</span></td>
                  <td className="text-right tabular-nums">{compact(v.visits)}</td>
                  <td className="text-right tabular-nums">{compact(v.pageviews)}</td>
                  <td className="text-right tabular-nums">{v.revenue ? <span className="chip bg-good-soft text-good">{money(v.revenue, site.currency)}</span> : <span className="text-faint">—</span>}</td>
                  <td className="text-right whitespace-nowrap text-muted">{ago(chDate(v.last_seen))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex justify-between">
        {page > 1 ? <Link className="btn-ghost" href={link({ page: String(page - 1) })}>← Previous</Link> : <span />}
        {rows.length > PAGE && <Link className="btn-ghost" href={link({ page: String(page + 1) })}>Next →</Link>}
      </div>
    </main>
  );
}
