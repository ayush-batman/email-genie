import Link from "next/link";
import { CircleDollarSign, Info } from "lucide-react";
import { requireSite } from "@/lib/auth.ts";
import { resolvePeriod } from "@/lib/dates.ts";
import { DIMENSIONS, PERIOD_LABELS, PERIODS, type Dimension, type Period } from "@/lib/query.ts";
import { recentPayments, revenueBy, revenueSeries, revenueSummary, type Attribution } from "@/lib/revenue.ts";
import { ago, chDate, compact, countryName, flag, money, pct } from "@/lib/format.ts";
import { visitorName } from "@/lib/names.ts";
import { sql } from "@/lib/db.ts";
import { PageHeader } from "@/components/shell.tsx";
import { VisitorAvatar } from "@/components/avatar.tsx";

export const metadata = { title: "Revenue" };

const DIMS: Dimension[] = ["channel", "referrer", "utm_source", "utm_campaign", "entry_page", "country", "device"];

export default async function RevenuePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { site } = await requireSite((await params).id);
  const sp = await searchParams;
  const period = (PERIODS as readonly string[]).includes(sp.period ?? "") && sp.period !== "custom" && sp.period !== "realtime" ? (sp.period as Period) : "30d";
  const model: Attribution = sp.model === "first_touch" ? "first_touch" : "last_touch";
  const dim = DIMS.includes(sp.by as Dimension) ? (sp.by as Dimension) : "channel";
  const scope = { siteId: site.id, tz: site.timezone, range: resolvePeriod(period, site.timezone), filters: [], currency: site.currency };
  const link = (p: Record<string, string>) => `?${new URLSearchParams({ period, model, by: dim, ...p })}`;
  const cur = site.currency;

  // entry_page can't be a first-touch column directly; fall back to url_path of the first pageview.
  const byDim: Dimension = dim === "entry_page" ? "page" : dim;
  const [summary, rows, series, recent, conns] = await Promise.all([
    revenueSummary(scope), revenueBy(scope, byDim, model), revenueSeries(scope), recentPayments(scope),
    sql<{ n: number }[]>`SELECT count(*)::int AS n FROM revenue_connections WHERE site_id = ${site.id}`,
  ]);
  const connected = (conns[0]?.n ?? 0) > 0;
  const empty = summary.orders === 0 && summary.refunds === 0;
  const maxRev = Math.max(1, ...rows.map((r) => r.revenue));
  const maxBar = Math.max(1, ...series.map((p) => p.payment + p.renewal));

  const kpis: [string, string, string?][] = [
    ["Net revenue", money(summary.revenue, cur), `${money(summary.newRevenue, cur)} new · ${money(summary.renewals, cur)} renewals`],
    ["Customers", compact(summary.customers), `${compact(summary.orders)} orders`],
    ["Conversion rate", pct(summary.conversion), `of ${compact(summary.visitors)} visitors`],
    ["Revenue per visitor", money(summary.rpv, cur)],
    ["Avg. order value", money(summary.aov, cur)],
    ["Refunds", money(summary.refunds, cur), summary.revenue ? `${pct(summary.refunds / Math.max(1, summary.newRevenue + summary.renewals))} of gross` : undefined],
    ["Time to convert", summary.avgDaysToConvert == null ? "—" : summary.avgDaysToConvert < 1 ? `${Math.round(summary.avgDaysToConvert * 24)}h` : `${summary.avgDaysToConvert.toFixed(1)} days`, "first visit → first payment"],
    ["Visits to convert", summary.avgVisitsToConvert == null ? "—" : summary.avgVisitsToConvert.toFixed(1), "visits before paying"],
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <PageHeader title="Revenue" description="Verified payments, attributed to the visit that drove them.">
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="model" value={model} />
          <input type="hidden" name="by" value={dim} />
          <select name="period" defaultValue={period} className="input w-auto" aria-label="Date range">
            {PERIODS.filter((p) => p !== "realtime" && p !== "custom").map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
          </select>
          <button className="btn-ghost">Apply</button>
        </form>
      </PageHeader>

      {empty && (
        <div className="panel mb-5 flex flex-wrap items-center gap-4 p-5">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-good-soft text-good"><CircleDollarSign className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{connected ? "No payments in this period yet" : "Connect your payment provider"}</p>
            <p className="text-sm text-muted">{connected ? "Payments appear here as soon as your provider sends a webhook." : "Stripe, Lemon Squeezy, Polar, Paddle, or any backend via API. Takes about two minutes."}</p>
          </div>
          {!connected && <Link href={`/sites/${site.id}/settings#revenue`} className="btn">Connect payments</Link>}
        </div>
      )}

      <section className="panel grid grid-cols-2 overflow-hidden lg:grid-cols-4">
        {kpis.map(([label, value, sub], i) => (
          <div key={label} className={`border-line p-5 ${i % 2 === 0 ? "border-r" : ""} lg:border-r ${(i + 1) % 4 === 0 ? "lg:border-r-0" : ""} ${i < 6 ? "border-b" : ""} ${i < 4 ? "lg:border-b" : "lg:border-b-0"}`}>
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className={`mt-1.5 text-[22px] font-semibold leading-none tracking-tight tabular-nums ${i === 0 ? "text-good" : ""}`}>{value}</p>
            {sub && <p className="mt-2 text-xs text-faint">{sub}</p>}
          </div>
        ))}
      </section>

      <section className="panel mt-5 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <h2 className="mr-auto text-[15px] font-semibold text-fg">Revenue over time</h2>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" /> New</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent/40" /> Renewals</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-bad/60" /> Refunds</span>
        </div>
        <div className="flex h-44 items-end gap-[3px]" role="img" aria-label="Revenue per period">
          {series.map((p) => (
            <div key={p.bucket} className="group relative flex h-full flex-1 flex-col justify-end" title={`${p.bucket}: ${money(p.payment, cur)} new, ${money(p.renewal, cur)} renewals${p.refund ? `, −${money(p.refund, cur)} refunds` : ""}`}>
              <div className="rounded-t-[3px] bg-accent/40 group-hover:brightness-110" style={{ height: `${(p.renewal / maxBar) * 100}%` }} />
              <div className={`bg-accent group-hover:brightness-110 ${p.renewal ? "" : "rounded-t-[3px]"}`} style={{ height: `${(p.payment / maxBar) * 100}%` }} />
              {p.refund > 0 && <div className="absolute -bottom-2 inset-x-0 h-1.5 rounded-b bg-bad/60" />}
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between text-[11px] text-faint">
          <span>{series[0]?.bucket}</span><span>{series.at(-1)?.bucket}</span>
        </div>
      </section>

      <section className="panel mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
          <h2 className="mr-auto text-[15px] font-semibold">Revenue by {DIMENSIONS[dim].label.toLowerCase()}</h2>
          <div className="tabs">
            {(["last_touch", "first_touch"] as const).map((m) => <Link key={m} href={link({ model: m })} aria-current={model === m} className="tab" scroll={false}>{m === "last_touch" ? "Last touch" : "First touch"}</Link>)}
          </div>
          <div className="tabs max-w-full overflow-x-auto">
            {DIMS.map((d) => <Link key={d} href={link({ by: d })} aria-current={dim === d} className="tab" scroll={false}>{d === "utm_source" ? "Source" : d === "utm_campaign" ? "Campaign" : d === "entry_page" ? "Landing page" : DIMENSIONS[d].label}</Link>)}
          </div>
        </div>
        <p className="flex items-center gap-1.5 border-b border-line bg-subtle px-5 py-2 text-xs text-muted">
          <Info className="h-3.5 w-3.5" />
          {model === "last_touch" ? "Credits the source of the visit in which the customer paid." : "Credits the source that first brought the customer to your site, even months earlier."}
        </p>
        {rows.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted">No attributed revenue in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full min-w-[640px]">
              <thead><tr><th>{dim === "entry_page" ? "Landing page" : DIMENSIONS[dim].label}</th><th className="text-right!">Visitors</th><th className="text-right!">Customers</th><th className="text-right!">Conv. rate</th><th className="text-right!">Rev / visitor</th><th className="w-48 text-right!">Revenue</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.value}>
                    <td className="font-medium">{dim === "country" && r.value ? `${flag(r.value)} ${countryName(r.value)}` : r.value || "Direct / none"}</td>
                    <td className="text-right tabular-nums text-muted">{r.visitors ? compact(r.visitors) : "—"}</td>
                    <td className="text-right tabular-nums">{compact(r.customers)}</td>
                    <td className="text-right tabular-nums">{r.visitors ? pct(r.conversion) : "—"}</td>
                    <td className="text-right tabular-nums text-muted">{r.visitors ? money(r.rpv, cur) : "—"}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-subtle sm:block"><div className="h-full rounded-full bg-good" style={{ width: `${(Math.max(0, r.revenue) / maxRev) * 100}%` }} /></div>
                        <span className="w-20 font-semibold tabular-nums">{money(r.revenue, cur)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(summary.unattributed !== 0 || summary.otherCurrencies.length > 0) && (
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            {summary.unattributed !== 0 && <>{money(summary.unattributed, cur)} couldn&apos;t be matched to a visitor (no <code>waypoint_visitor_id</code> on the payment). </>}
            {summary.otherCurrencies.length > 0 && <>Not converted: {summary.otherCurrencies.map((o) => money(o.amount, o.currency)).join(", ")}.</>}
          </p>
        )}
      </section>

      <section className="panel mt-5 overflow-hidden">
        <h2 className="border-b border-line p-5 text-[15px] font-semibold">Recent payments</h2>
        {recent.length === 0 ? <p className="py-10 text-center text-sm text-muted">No payments yet.</p> : (
          <ul className="divide-y divide-line">
            {recent.map((p, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                {p.visitor_id ? <VisitorAvatar id={p.visitor_id} /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-subtle text-xs text-faint">?</span>}
                <div className="min-w-0 flex-1">
                  {p.visitor_id ? (
                    <Link href={`/sites/${site.id}/visitors/${encodeURIComponent(p.visitor_id)}`} className="font-medium hover:underline">{p.user_id || visitorName(p.visitor_id)}</Link>
                  ) : <span className="font-medium text-muted">Unattributed</span>}
                  <p className="truncate text-xs text-muted">
                    {p.visitor_id ? <>via {p.referrer_domain || p.channel}{p.utm_campaign && ` · ${p.utm_campaign}`}{p.country && ` · ${flag(p.country)}`}</> : "No visitor id on payment"} · {p.provider}
                  </p>
                </div>
                <span className={`chip ${p.name === "refund" ? "bg-bad-soft text-bad" : p.name === "renewal" ? "bg-accent-soft text-accent" : "bg-good-soft text-good"}`}>{p.name}</span>
                <span className={`w-24 text-right font-semibold tabular-nums ${p.revenue_minor < 0 ? "text-bad" : ""}`}>{money(p.revenue_minor, p.revenue_currency)}</span>
                <span className="hidden w-20 text-right text-xs text-faint sm:block">{ago(chDate(p.time))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
