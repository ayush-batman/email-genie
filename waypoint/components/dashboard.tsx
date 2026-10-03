import Link from "next/link";
import { decodeFilters, DIMENSIONS, encodeFilters, FILTER_OPS, PERIOD_LABELS, PERIODS, type Dimension, type Filter, type Period } from "@/lib/query.ts";
import { previousRange, resolvePeriod } from "@/lib/dates.ts";
import { breakdown, firstEventAt, kpis, timeseries, type Kpis, type Point, type Scope } from "@/lib/stats.ts";
import type { Site } from "@/lib/db.ts";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const KPI_DEFS: { key: keyof Kpis; label: string; fmt: (n: number) => string; lowerIsBetter?: boolean }[] = [
  { key: "visitors", label: "Visitors", fmt: compact },
  { key: "visits", label: "Visits", fmt: compact },
  { key: "pageviews", label: "Pageviews", fmt: compact },
  { key: "views_per_visit", label: "Views / visit", fmt: (n) => n.toFixed(2) },
  { key: "bounce_rate", label: "Bounce rate", fmt: pct, lowerIsBetter: true },
  { key: "visit_duration", label: "Visit duration", fmt: duration },
  { key: "events", label: "Events", fmt: compact },
  { key: "revenue", label: "Revenue", fmt: money },
];

const PANELS: { param: string; title: string; tabs: (Dimension | `prop:${string}`)[]; countLabel: string }[] = [
  { param: "src", title: "Sources", tabs: ["channel", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"], countLabel: "Visits" },
  { param: "pg", title: "Pages", tabs: ["page", "entry_page", "exit_page", "title", "hostname"], countLabel: "Views" },
  { param: "loc", title: "Locations", tabs: ["country", "region", "city", "language"], countLabel: "Visits" },
  { param: "dev", title: "Devices", tabs: ["device", "browser", "os", "screen"], countLabel: "Visits" },
  { param: "ev", title: "Events", tabs: ["event"], countLabel: "Events" },
];

export function compact(n: number) {
  return Intl.NumberFormat("en", { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}
export function pct(n: number) {
  return `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
}
export function duration(s: number) {
  const m = Math.floor(s / 60);
  return m ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
}
export function money(minor: number) {
  return Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: minor >= 100_000 ? 0 : 2 }).format(minor / 100);
}

const COUNTRY = new Intl.DisplayNames(["en"], { type: "region" });
function label(dim: string, value: string) {
  if (!value) return dim === "referrer" || dim === "channel" || dim.startsWith("utm_") ? "Direct / none" : "Unknown";
  if (dim === "country") {
    try {
      const flag = String.fromCodePoint(...[...value.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
      return `${flag} ${COUNTRY.of(value) ?? value}`;
    } catch {
      return value;
    }
  }
  return value;
}

export async function Dashboard({ site, sp, basePath, readOnly = false }: { site: Site; sp: SP; basePath: string; readOnly?: boolean }) {
  const period = (PERIODS as readonly string[]).includes(one(sp.period)) ? (one(sp.period) as Period) : "30d";
  let filters = decodeFilters(one(sp.f));
  // "Add filter" form submits fd/fo/fv; fold them into f.
  const fd = one(sp.fd), fo = one(sp.fo), fv = one(sp.fv).trim();
  if (fd in DIMENSIONS && (FILTER_OPS as readonly string[]).includes(fo) && fv) filters = [...filters, { dim: fd as Dimension, op: fo as Filter["op"], value: fv }];
  const metric = (KPI_DEFS.find((k) => k.key === one(sp.metric))?.key ?? "visitors") as keyof Kpis;

  const first = period === "all" ? await firstEventAt(site.id) : null;
  const range = resolvePeriod(period, site.timezone, { from: one(sp.from), to: one(sp.to), firstEventAt: first });
  const scope: Scope = { siteId: site.id, tz: site.timezone, range, filters };
  const prevScope: Scope = { ...scope, range: previousRange(range) };

  const state = { period, from: one(sp.from), to: one(sp.to), f: encodeFilters(filters), metric, src: one(sp.src), pg: one(sp.pg), loc: one(sp.loc), dev: one(sp.dev), ev: one(sp.ev) };
  const href = (patch: Partial<typeof state> & { expand?: string; q?: string; page?: string }) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...state, ...patch })) if (v && !(k === "period" && v === "30d") && !(k === "metric" && v === "visitors")) q.set(k, v);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const withFilter = (f: Filter) => href({ f: encodeFilters([...filters.filter((x) => x.dim !== f.dim), f]) });

  const expand = one(sp.expand);
  if (expand) return <Expanded scope={scope} dim={expand as Dimension} sp={sp} href={href} withFilter={withFilter} siteId={site.id} readOnly={readOnly} />;

  const [now, prev, series, prevSeries] = await Promise.all([kpis(scope), kpis(prevScope), timeseries(scope), timeseries(prevScope)]);
  const panelData = await Promise.all(
    PANELS.map(async (p) => {
      const tab = (p.tabs as string[]).includes(state[p.param as keyof typeof state]) ? (state[p.param as keyof typeof state] as Dimension) : p.tabs[0]!;
      return { ...p, tab, rows: await breakdown(scope, tab, 10) };
    }),
  );
  const csv = (dim: string) => `/api/sites/${site.id}/export?${new URLSearchParams({ dim, period, from: state.from, to: state.to, f: state.f })}`;

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <Toolbar state={state} href={href} filters={filters} />

      <section className="panel overflow-hidden">
        <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4 lg:grid-cols-8">
          {KPI_DEFS.map((k) => {
            const v = now[k.key], p = prev[k.key];
            const delta = p ? (v - p) / p : null;
            const good = delta !== null && (k.lowerIsBetter ? delta < 0 : delta > 0);
            return (
              <Link key={k.key} href={href({ metric: k.key })} aria-current={metric === k.key} className={`border-line p-4 hover:bg-bg ${metric === k.key ? "bg-accent-soft/50 shadow-[inset_0_-2px_0_var(--accent)]" : ""}`}>
                <div className="text-xs font-medium text-muted">{k.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{k.fmt(v)}</div>
                {delta !== null && Number.isFinite(delta) && Math.abs(delta) >= 0.001 && (
                  <div className={`text-xs tabular-nums ${good ? "text-good" : "text-bad"}`}>{delta > 0 ? "↑" : "↓"} {Math.abs(delta * 100).toFixed(0)}%</div>
                )}
              </Link>
            );
          })}
        </div>
        <Chart series={series} prev={prevSeries} metric={metric} fmt={KPI_DEFS.find((k) => k.key === metric)!.fmt} interval={range.interval} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {panelData.map((p) => (
          <section key={p.param} className="panel flex flex-col p-4">
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="mr-auto font-medium">{p.title}</h2>
              {p.tabs.length > 1 && p.tabs.map((t) => (
                <Link key={t} href={href({ [p.param]: t })} className={`text-xs ${t === p.tab ? "font-medium text-accent" : "text-muted hover:text-fg"}`}>
                  {DIMENSIONS[t as Dimension]?.label ?? t}
                </Link>
              ))}
            </div>
            <Rows rows={p.rows} dim={p.tab} countLabel={p.countLabel} withFilter={withFilter} />
            <div className="mt-auto flex justify-between pt-3 text-xs">
              <Link href={href({ expand: p.tab })} className="text-muted hover:text-fg">View all →</Link>
              {!readOnly && <a href={csv(p.tab)} className="text-muted hover:text-fg">Export CSV</a>}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function Toolbar({ state, href, filters }: { state: { period: Period; from: string; to: string; f: string; metric: string }; href: (p: Record<string, string>) => string; filters: Filter[] }) {
  const keep = (omit: string[]) =>
    Object.entries(state).filter(([k, v]) => v && !omit.includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form className="flex flex-wrap items-center gap-2">
        {keep(["period", "from", "to"])}
        <select name="period" defaultValue={state.period} className="input w-auto" aria-label="Date range">
          {PERIODS.filter((p) => p !== "realtime").map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
        </select>
        <input type="date" name="from" defaultValue={state.from} className="input w-auto" aria-label="From (custom range)" />
        <input type="date" name="to" defaultValue={state.to} className="input w-auto" aria-label="To (custom range)" />
        <button className="btn-ghost">Apply</button>
      </form>
      <details className="relative">
        <summary className="btn-ghost cursor-pointer list-none">+ Filter</summary>
        <form className="panel absolute z-10 mt-2 flex w-72 flex-col gap-2 p-3 shadow-lg">
          {keep([])}
          <select name="fd" className="input" aria-label="Dimension">
            {Object.entries(DIMENSIONS).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
          </select>
          <select name="fo" className="input" aria-label="Operator">
            {FILTER_OPS.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
          </select>
          <input name="fv" className="input" placeholder="Value" required aria-label="Value" />
          <button className="btn justify-center">Add filter</button>
        </form>
      </details>
      {filters.map((f, i) => (
        <span key={i} className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs">
          {DIMENSIONS[f.dim].label} {f.op.replace("_", " ")} <b>{f.value || "(none)"}</b>
          <Link href={href({ f: encodeFilters(filters.filter((_, j) => j !== i)) })} aria-label="Remove filter">✕</Link>
        </span>
      ))}
      {filters.length > 1 && <Link href={href({ f: "" })} className="text-xs text-muted">Clear all</Link>}
    </div>
  );
}

function Rows({ rows, dim, countLabel, withFilter }: { rows: Awaited<ReturnType<typeof breakdown>>; dim: string; countLabel: string; withFilter: (f: Filter) => string }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted">No data for this period.</p>;
  const filterable = dim in DIMENSIONS;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted">
          <th className="pb-2 text-left font-normal">{DIMENSIONS[dim as Dimension]?.label ?? dim}</th>
          <th className="w-20 pb-2 text-right font-normal">Visitors</th>
          <th className="w-20 pb-2 text-right font-normal">{countLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.value} className="group">
            <td className="relative max-w-0 py-1 pr-2">
              <div className="absolute inset-y-0.5 left-0 rounded bg-accent-soft" style={{ width: `${Math.max(1, r.share * 100)}%` }} />
              {filterable ? (
                <Link href={withFilter({ dim: dim as Dimension, op: "is", value: r.value })} className="relative block truncate px-2 group-hover:underline" title={r.value}>{label(dim, r.value)}</Link>
              ) : (
                <span className="relative block truncate px-2">{label(dim, r.value)}</span>
              )}
            </td>
            <td className="py-1 text-right tabular-nums">{compact(r.visitors)}</td>
            <td className="py-1 text-right tabular-nums text-muted">{compact(r.count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Chart({ series, prev, metric, fmt, interval }: { series: Point[]; prev: Point[]; metric: keyof Kpis; fmt: (n: number) => string; interval: string }) {
  const W = 1000, H = 220, P = 8;
  const vals = series.map((p) => p[metric]);
  const pvals = prev.map((p) => p[metric]);
  const max = Math.max(1, ...vals, ...pvals) * 1.1;
  const x = (i: number) => P + (i / Math.max(1, series.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = (vs: number[]) => vs.slice(0, series.length).map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const fmtBucket = (b: string) => (interval === "hour" || interval === "minute" ? b.slice(11, 16) : b.slice(0, 10));
  const ticks = [0, Math.floor((series.length - 1) / 2), series.length - 1].filter((v, i, a) => a.indexOf(v) === i && series[v]);

  return (
    <figure className="relative p-4">
      <span className="absolute left-5 top-3 text-xs tabular-nums text-muted">{fmt(max / 1.1)}</span>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" preserveAspectRatio="none" role="img" aria-label={`${metric} over time`}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--line)" strokeDasharray="2 4" />)}
        <path d={line(pvals)} fill="none" stroke="var(--muted)" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={`${line(vals)}L${x(series.length - 1)},${H - P}L${x(0)},${H - P}Z`} fill="var(--accent)" fillOpacity={0.08} />
        <path d={line(vals)} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {series.map((p, i) => (
          <rect key={p.bucket} x={x(i) - (W / series.length) / 2} y={0} width={W / series.length} height={H} fill="transparent">
            <title>{`${p.bucket}: ${fmt(p[metric])}${prev[i] ? ` (previous: ${fmt(prev[i]![metric])})` : ""}`}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-muted">
        {ticks.map((t) => <span key={t}>{fmtBucket(series[t]!.bucket)}</span>)}
      </figcaption>
      <p className="mt-1 text-xs text-muted"><span className="text-accent">━</span> current period · <span>┅</span> previous period</p>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <table className="mt-2 w-full max-w-md">
          <tbody>{series.map((p, i) => <tr key={p.bucket}><td>{p.bucket}</td><td className="text-right tabular-nums">{fmt(p[metric])}</td><td className="text-right tabular-nums text-muted">{prev[i] ? fmt(prev[i]![metric]) : ""}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

async function Expanded({ scope, dim, sp, href, withFilter, siteId, readOnly }: { scope: Scope; dim: Dimension; sp: SP; href: (p: Record<string, string>) => string; withFilter: (f: Filter) => string; siteId: string; readOnly: boolean }) {
  if (!(dim in DIMENSIONS)) return null;
  const PAGE = 50;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const q = one(sp.q);
  const rows = await breakdown(scope, dim, PAGE + 1, (page - 1) * PAGE, q);
  const csvQ = new URLSearchParams({ dim, period: one(sp.period), from: one(sp.from), to: one(sp.to), f: one(sp.f) });
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Link href={href({})} className="text-sm text-muted">← Back to dashboard</Link>
      <div className="mt-3 mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">{DIMENSIONS[dim].label}</h1>
        <form className="flex gap-2">
          {Object.entries(sp).filter(([k]) => !["q", "page"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={one(v)} />)}
          <input name="q" defaultValue={q} placeholder="Search" className="input w-48" aria-label="Search" />
        </form>
        {!readOnly && <a className="btn-ghost" href={`/api/sites/${siteId}/export?${csvQ}`}>Export CSV</a>}
      </div>
      <div className="panel p-4"><Rows rows={rows.slice(0, PAGE)} dim={dim} countLabel="Count" withFilter={withFilter} /></div>
      <div className="mt-3 flex justify-between text-sm">
        {page > 1 ? <Link href={href({ expand: dim, q, page: String(page - 1) })}>← Previous</Link> : <span />}
        {rows.length > PAGE && <Link href={href({ expand: dim, q, page: String(page + 1) })}>Next →</Link>}
      </div>
    </main>
  );
}
