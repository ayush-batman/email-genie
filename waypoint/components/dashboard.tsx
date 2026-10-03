import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Calendar, ChevronDown, Download, Filter as FilterIcon, Maximize2, Search, Target, X } from "lucide-react";
import { decodeFilters, DIMENSIONS, encodeFilters, FILTER_OPS, PERIOD_LABELS, PERIODS, type Dimension, type Filter, type Period } from "@/lib/query.ts";
import { formatYmd, previousRange, resolvePeriod, zonedYmd } from "@/lib/dates.ts";
import { breakdown, firstEventAt, goalStats, kpis, onlineNow, timeseries, type BreakdownRow, type Goal, type Kpis, type Scope } from "@/lib/stats.ts";
import { compact, countryName, duration, flag, money, pct } from "@/lib/format.ts";
import { sql, type Site } from "@/lib/db.ts";
import { Chart, type ChartMetric } from "./chart.tsx";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const KPI_DEFS: { key: ChartMetric; label: string; lowerIsBetter?: boolean }[] = [
  { key: "visitors", label: "Visitors" },
  { key: "visits", label: "Visits" },
  { key: "pageviews", label: "Pageviews" },
  { key: "views_per_visit", label: "Views per visit" },
  { key: "bounce_rate", label: "Bounce rate", lowerIsBetter: true },
  { key: "visit_duration", label: "Visit duration" },
  { key: "events", label: "Events" },
  { key: "revenue", label: "Revenue" },
];

const PANELS: { param: string; title: string; tabs: Dimension[]; countLabel: string; revenue: boolean }[] = [
  { param: "src", title: "Sources", tabs: ["channel", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"], countLabel: "Visits", revenue: true },
  { param: "pg", title: "Pages", tabs: ["page", "entry_page", "exit_page", "title", "hostname"], countLabel: "Views", revenue: false },
  { param: "loc", title: "Locations", tabs: ["country", "region", "city", "language"], countLabel: "Visits", revenue: true },
  { param: "dev", title: "Devices", tabs: ["device", "browser", "os", "screen"], countLabel: "Visits", revenue: true },
];
const TAB_LABEL: Partial<Record<Dimension, string>> = { utm_source: "Source", utm_medium: "Medium", utm_campaign: "Campaign", utm_term: "Term", utm_content: "Content", entry_page: "Entry", exit_page: "Exit", title: "Title", hostname: "Host" };

function fmtKpi(k: ChartMetric, v: number, currency: string) {
  return k === "bounce_rate" ? pct(v) : k === "visit_duration" ? duration(v) : k === "revenue" ? money(v, currency) : k === "views_per_visit" ? v.toFixed(2) : compact(v);
}

function label(dim: string, value: string) {
  if (!value) return dim === "referrer" || dim === "channel" || dim.startsWith("utm_") ? "Direct / none" : "Unknown";
  if (dim === "country") return `${flag(value)}  ${countryName(value)}`;
  return value;
}

export async function Dashboard({ site, sp, basePath, readOnly = false }: { site: Site; sp: SP; basePath: string; readOnly?: boolean }) {
  const period = (PERIODS as readonly string[]).includes(one(sp.period)) ? (one(sp.period) as Period) : "30d";
  let filters = decodeFilters(one(sp.f));
  // The "Add filter" form submits fd/fo/fv; fold them into f.
  const fd = one(sp.fd), fo = one(sp.fo), fv = one(sp.fv).trim();
  if (fd in DIMENSIONS && (FILTER_OPS as readonly string[]).includes(fo) && fv) filters = [...filters, { dim: fd as Dimension, op: fo as Filter["op"], value: fv }];
  const metric = KPI_DEFS.find((k) => k.key === one(sp.metric))?.key ?? "visitors";

  const first = period === "all" ? await firstEventAt(site.id) : null;
  const range = resolvePeriod(period, site.timezone, { from: one(sp.from), to: one(sp.to), firstEventAt: first });
  const scope: Scope = { siteId: site.id, tz: site.timezone, range, filters, currency: site.currency };
  const prevScope: Scope = { ...scope, range: previousRange(range) };

  const state = { period, from: one(sp.from), to: one(sp.to), f: encodeFilters(filters), metric, src: one(sp.src), pg: one(sp.pg), loc: one(sp.loc), dev: one(sp.dev) };
  type Patch = Partial<Record<keyof typeof state | "expand" | "q" | "page", string>>;
  const href = (patch: Patch) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...state, ...patch })) {
      if (!v || (k === "period" && v === "30d") || (k === "metric" && v === "visitors")) continue;
      if ((k === "from" || k === "to") && ({ ...state, ...patch }).period !== "custom") continue;
      q.set(k, v);
    }
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const withFilter = (f: Filter) => href({ f: encodeFilters([...filters.filter((x) => x.dim !== f.dim), f]) });

  const expand = one(sp.expand);
  if (expand && expand in DIMENSIONS) return <Expanded scope={scope} dim={expand as Dimension} sp={sp} href={href} withFilter={withFilter} siteId={site.id} readOnly={readOnly} currency={site.currency} />;

  const goals = await sql<Goal[]>`SELECT id, name, kind, match FROM goals WHERE site_id = ${site.id} ORDER BY created_at`;
  const [now, prev, series, prevSeries, online, goalRows, events] = await Promise.all([
    kpis(scope), kpis(prevScope), timeseries(scope), timeseries(prevScope), onlineNow(site.id), goalStats(scope, goals), breakdown(scope, "event", 8),
  ]);
  const panelData = await Promise.all(
    PANELS.map(async (p) => {
      const cur = state[p.param as keyof typeof state] as Dimension;
      const tab = p.tabs.includes(cur) ? cur : p.tabs[0]!;
      return { ...p, tab, rows: await breakdown(scope, tab, 9) };
    }),
  );
  const hasRevenue = now.revenue !== 0 || prev.revenue !== 0;
  const csv = (dim: string) => `/api/sites/${site.id}/export?${new URLSearchParams({ dim, period, from: state.from, to: state.to, f: state.f })}`;
  const metricLabel = KPI_DEFS.find((k) => k.key === metric)!.label;

  return (
    <main className="mx-auto max-w-[1200px] space-y-5 px-4 py-6 sm:px-8">
      <Toolbar state={state} href={href} filters={filters} range={range} tz={site.timezone} online={online} livePath={readOnly ? null : `/sites/${site.id}/live`} />

      <section className="panel overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
          {KPI_DEFS.map((k, i) => {
            const v = now[k.key as keyof Kpis], p = prev[k.key as keyof Kpis];
            const delta = p ? (v - p) / p : null;
            const show = delta !== null && Number.isFinite(delta) && Math.abs(delta) >= 0.005 && Math.abs(delta) < 10;
            const good = show && (k.lowerIsBetter ? delta! < 0 : delta! > 0);
            const active = metric === k.key;
            return (
              <Link
                key={k.key}
                href={href({ metric: k.key })}
                scroll={false}
                aria-current={active}
                className={`relative border-line px-5 py-4 transition-colors hover:bg-subtle ${i % 2 ? "" : "border-r"} sm:border-r ${(i + 1) % 4 === 0 ? "sm:border-r-0 xl:border-r" : ""} ${i === 7 ? "xl:border-r-0" : ""} ${i < 6 ? "border-b sm:border-b-0" : ""} ${i < 4 ? "sm:border-b xl:border-b-0" : ""}`}
              >
                {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
                <div className={`text-xs font-medium ${active ? "text-accent" : "text-muted"}`}>{k.label}</div>
                <div className="mt-1.5 text-[22px] font-semibold leading-none tracking-tight tabular-nums">{fmtKpi(k.key, v, site.currency)}</div>
                <div className="mt-2 h-4 text-xs">
                  {show ? (
                    <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${good ? "text-good" : "text-bad"}`}>
                      {delta! > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {Math.abs(delta! * 100).toFixed(Math.abs(delta!) < 0.1 ? 1 : 0)}%
                    </span>
                  ) : <span className="text-faint">—</span>}
                </div>
              </Link>
            );
          })}
        </div>
        <div className="border-t border-line px-5 pt-5 pb-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="font-medium text-fg">{metricLabel}</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-accent" /> {PERIOD_LABELS[period]}</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-3 border-t border-dashed border-faint" /> Previous period</span>
          </div>
          <Chart points={series.map((p) => ({ bucket: p.bucket, value: p[metric as keyof Kpis] }))} prev={prevSeries.map((p) => p[metric as keyof Kpis])} metric={metric} interval={range.interval} currency={site.currency} metricLabel={metricLabel} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {panelData.map((p) => (
          <Panel key={p.param} title={p.title} actions={
            p.tabs.length > 1 && (
              <div className="tabs max-w-full overflow-x-auto">
                {p.tabs.map((t) => <Link key={t} href={href({ [p.param]: t })} scroll={false} aria-current={t === p.tab} className="tab">{TAB_LABEL[t] ?? DIMENSIONS[t].label}</Link>)}
              </div>
            )
          } footer={<PanelFooter expand={href({ expand: p.tab })} csv={readOnly ? null : csv(p.tab)} />}>
            <Rows rows={p.rows} dim={p.tab} countLabel={p.countLabel} withFilter={withFilter} revenue={p.revenue && hasRevenue ? site.currency : null} />
          </Panel>
        ))}

        <Panel title="Events" footer={<PanelFooter expand={href({ expand: "event" })} csv={readOnly ? null : csv("event")} />}>
          <Rows rows={events} dim="event" countLabel="Events" withFilter={withFilter} revenue={hasRevenue ? site.currency : null} empty="No custom events yet. Call waypoint.track('signup') to record one." />
        </Panel>

        <Panel title="Goals" actions={!readOnly && <Link href={`/sites/${site.id}/goals`} className="text-xs text-muted hover:text-fg">Manage</Link>}>
          {goalRows.length === 0 ? (
            <div className="grid place-items-center py-10 text-center">
              <Target className="h-6 w-6 text-faint" />
              <p className="mt-2 text-sm text-muted">Track signups, purchases or key pages as goals.</p>
              {!readOnly && <Link href={`/sites/${site.id}/goals`} className="btn-ghost mt-3">Add a goal</Link>}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-medium">Goal</th><th className="pb-2 text-right font-medium">Visitors</th><th className="pb-2 text-right font-medium">Conv. rate</th></tr></thead>
              <tbody>
                {goalRows.map((g) => (
                  <tr key={g.id}>
                    <td className="py-1.5"><span className="font-medium">{g.name}</span> <span className="text-xs text-faint">{g.kind === "event" ? "event" : "page"} · {g.match}</span></td>
                    <td className="py-1.5 text-right tabular-nums">{compact(g.visitors)}</td>
                    <td className="py-1.5 text-right tabular-nums"><span className="chip bg-accent-soft text-accent">{pct(g.rate)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </main>
  );
}

function Panel({ title, actions, footer, children }: { title: string; actions?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel flex min-w-0 flex-col p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {actions}
      </div>
      <div className="flex-1">{children}</div>
      {footer}
    </section>
  );
}

function PanelFooter({ expand, csv }: { expand: string; csv: string | null }) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
      <Link href={expand} className="inline-flex items-center gap-1.5 text-muted hover:text-fg"><Maximize2 className="h-3.5 w-3.5" /> Details</Link>
      {csv && <a href={csv} className="inline-flex items-center gap-1.5 text-muted hover:text-fg"><Download className="h-3.5 w-3.5" /> CSV</a>}
    </div>
  );
}

function Toolbar({ state, href, filters, range, tz, online, livePath }: {
  state: { period: Period; from: string; to: string; f: string; metric: string };
  href: (p: Record<string, string>) => string;
  filters: Filter[];
  range: { from: Date; to: Date };
  tz: string;
  online: number;
  livePath: string | null;
}) {
  const hidden = (omit: string[]) => Object.entries(state).filter(([k, v]) => v && !omit.includes(k) && !(k === "from" || k === "to")).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  const fromYmd = formatYmd(zonedYmd(range.from, tz));
  const toYmd = formatYmd(zonedYmd(new Date(range.to.getTime() - 1), tz));
  const rangeText = `${new Date(fromYmd + "T00:00").toLocaleDateString("en", { month: "short", day: "numeric", year: fromYmd.slice(0, 4) !== toYmd.slice(0, 4) ? "numeric" : undefined })} – ${new Date(toYmd + "T00:00").toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <details className="relative" key={`p-${state.period}-${state.from}-${state.to}`}>
        <summary className="btn-ghost cursor-pointer">
          <Calendar className="h-4 w-4 text-muted" />
          {state.period === "custom" ? rangeText : PERIOD_LABELS[state.period]}
          <ChevronDown className="h-3.5 w-3.5 text-faint" />
        </summary>
        <div className="popover absolute left-0 z-30 mt-1.5 w-64 p-1.5">
          {PERIODS.filter((p) => p !== "realtime" && p !== "custom").map((p) => (
            <Link key={p} href={href({ period: p })} aria-current={p === state.period} className="block rounded-md px-2.5 py-1.5 text-sm hover:bg-subtle aria-[current=true]:bg-accent-soft aria-[current=true]:font-medium aria-[current=true]:text-accent">{PERIOD_LABELS[p]}</Link>
          ))}
          <form className="mt-1 space-y-2 border-t border-line p-2">
            {hidden(["period"])}
            <input type="hidden" name="period" value="custom" />
            <p className="text-xs font-medium text-muted">Custom range</p>
            <div className="flex gap-2">
              <input type="date" name="from" required defaultValue={state.from || fromYmd} className="input px-2 text-xs" aria-label="From" />
              <input type="date" name="to" required defaultValue={state.to || toYmd} className="input px-2 text-xs" aria-label="To" />
            </div>
            <button className="btn h-8 w-full text-xs">Apply</button>
          </form>
        </div>
      </details>

      <details className="relative" key={`f-${state.f}`}>
        <summary className="btn-ghost cursor-pointer"><FilterIcon className="h-4 w-4 text-muted" /> Filter</summary>
        <form className="popover absolute left-0 z-30 mt-1.5 flex w-72 flex-col gap-2 p-3">
          {hidden([])}
          {state.from && <input type="hidden" name="from" value={state.from} />}
          {state.to && <input type="hidden" name="to" value={state.to} />}
          <p className="text-xs font-medium text-muted">Show only visits where</p>
          <select name="fd" className="input" aria-label="Dimension">
            {Object.entries(DIMENSIONS).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
          </select>
          <select name="fo" className="input" aria-label="Operator">
            {FILTER_OPS.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
          </select>
          <input name="fv" className="input" placeholder="Value, e.g. /pricing" required aria-label="Value" />
          <button className="btn">Apply filter</button>
        </form>
      </details>

      {filters.map((f, i) => (
        <span key={i} className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-accent/30 bg-accent-soft pl-3 pr-1.5 text-xs">
          <span className="text-muted">{DIMENSIONS[f.dim].label}</span>
          <span className="text-muted">{f.op.replace("_", " ")}</span>
          <b className="max-w-40 truncate">{f.value || "(none)"}</b>
          <Link href={href({ f: encodeFilters(filters.filter((_, j) => j !== i)) })} aria-label={`Remove ${DIMENSIONS[f.dim].label} filter`} className="rounded p-1 text-muted hover:bg-panel hover:text-fg"><X className="h-3.5 w-3.5" /></Link>
        </span>
      ))}
      {filters.length > 1 && <Link href={href({ f: "" })} className="text-xs text-muted hover:text-fg">Clear all</Link>}

      <span className="ml-auto hidden text-xs text-faint sm:inline">{rangeText}</span>
      {livePath ? (
        <Link href={livePath} className="chip h-7 bg-good-soft px-2.5 text-good hover:brightness-95">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" /><span className="relative h-2 w-2 rounded-full bg-good" /></span>
          {online} online
        </Link>
      ) : (
        <span className="chip h-7 bg-good-soft px-2.5 text-good"><span className="h-2 w-2 rounded-full bg-good" /> {online} online</span>
      )}
    </div>
  );
}

function Rows({ rows, dim, countLabel, withFilter, revenue, empty = "No data for this period." }: {
  rows: BreakdownRow[]; dim: string; countLabel: string; withFilter: (f: Filter) => string; revenue: string | null; empty?: string;
}) {
  if (!rows.length) return <p className="grid h-full min-h-32 place-items-center text-center text-sm text-muted">{empty}</p>;
  const filterable = dim in DIMENSIONS;
  const max = Math.max(...rows.map((r) => r.visitors));
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="text-xs text-muted">
          <th className="pb-2 text-left font-medium">{DIMENSIONS[dim as Dimension]?.label ?? dim}</th>
          <th className="w-20 pb-2 text-right font-medium">Visitors</th>
          <th className="hidden w-16 pb-2 text-right font-medium sm:table-cell">{countLabel}</th>
          {revenue && <th className="w-20 pb-2 text-right font-medium">Revenue</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.value} className="group">
            <td className="relative py-[3px] pr-3">
              <div className="absolute inset-y-[3px] left-0 rounded-md bg-bar transition-colors group-hover:bg-accent-soft" style={{ width: `calc(${(r.visitors / max) * 100}% - 12px)` }} />
              {filterable ? (
                <Link href={withFilter({ dim: dim as Dimension, op: "is", value: r.value })} className="relative block truncate px-2 py-1" title={`Filter by ${r.value || "none"}`}>{label(dim, r.value)}</Link>
              ) : (
                <span className="relative block truncate px-2 py-1">{label(dim, r.value)}</span>
              )}
            </td>
            <td className="text-right font-medium tabular-nums">{compact(r.visitors)}</td>
            <td className="hidden text-right tabular-nums text-muted sm:table-cell">{compact(r.count)}</td>
            {revenue && <td className="text-right tabular-nums text-muted">{r.revenue ? money(r.revenue, revenue) : "—"}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function Expanded({ scope, dim, sp, href, withFilter, siteId, readOnly, currency }: {
  scope: Scope; dim: Dimension; sp: SP; href: (p: Record<string, string>) => string; withFilter: (f: Filter) => string; siteId: string; readOnly: boolean; currency: string;
}) {
  const PAGE = 50;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const q = one(sp.q);
  const rows = await breakdown(scope, dim, PAGE + 1, (page - 1) * PAGE, q);
  const csvQ = new URLSearchParams({ dim, period: one(sp.period), from: one(sp.from), to: one(sp.to), f: one(sp.f) });
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
      <Link href={href({})} className="text-sm text-muted hover:text-fg">← Back to overview</Link>
      <div className="mt-4 mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold tracking-tight">{DIMENSIONS[dim].label}</h1>
        <form className="relative">
          {Object.entries(sp).filter(([k]) => !["q", "page"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={one(v)} />)}
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-faint" />
          <input name="q" defaultValue={q} placeholder="Search" className="input w-56 pl-8" aria-label="Search" />
        </form>
        {!readOnly && <a className="btn-ghost" href={`/api/sites/${siteId}/export?${csvQ}`}><Download className="h-4 w-4" /> Export CSV</a>}
      </div>
      <div className="panel p-5"><Rows rows={rows.slice(0, PAGE)} dim={dim} countLabel="Count" withFilter={withFilter} revenue={rows.some((r) => r.revenue) ? currency : null} /></div>
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link className="btn-ghost" href={href({ expand: dim, q, page: String(page - 1) })}>← Previous</Link> : <span />}
        {rows.length > PAGE && <Link className="btn-ghost" href={href({ expand: dim, q, page: String(page + 1) })}>Next →</Link>}
      </div>
    </main>
  );
}
