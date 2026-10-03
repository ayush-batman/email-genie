"use client";

import { useState } from "react";
import { compact, duration, money, pct } from "@/lib/format.ts";

export type ChartMetric = "visitors" | "visits" | "pageviews" | "views_per_visit" | "bounce_rate" | "visit_duration" | "events" | "revenue";

const fmtFor = (m: ChartMetric, currency: string) =>
  m === "bounce_rate" ? pct : m === "visit_duration" ? duration : m === "revenue" ? (n: number) => money(n, currency) : m === "views_per_visit" ? (n: number) => n.toFixed(2) : compact;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((m) => m >= v)!;
}

function label(bucket: string, interval: string, long = false) {
  const d = new Date(bucket.length === 10 ? `${bucket}T00:00:00` : bucket.replace(" ", "T"));
  if (interval === "minute" || interval === "hour") return d.toLocaleTimeString("en", { hour: "numeric", minute: interval === "minute" ? "2-digit" : undefined });
  if (interval === "month") return d.toLocaleDateString("en", { month: long ? "long" : "short", year: "numeric" });
  const s = d.toLocaleDateString("en", { month: "short", day: "numeric", ...(long ? { weekday: "short" } : {}) });
  return interval === "week" && long ? `Week of ${s}` : s;
}

export function Chart({ points, prev, metric, interval, currency, metricLabel }: {
  points: { bucket: string; value: number }[];
  prev: number[];
  metric: ChartMetric;
  interval: string;
  currency: string;
  metricLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const fmt = fmtFor(metric, currency);
  const W = 1000, H = 260, L = 0, B = 24, T = 12;
  const max = niceMax(Math.max(...points.map((p) => p.value), ...prev.slice(0, points.length)) * 1.05);
  const n = points.length;
  const x = (i: number) => L + (n <= 1 ? 0.5 : i / (n - 1)) * (W - L);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const path = (vs: number[]) => vs.slice(0, n).map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const values = points.map((p) => p.value);
  const tickEvery = Math.max(1, Math.ceil(n / 7));
  const h = hover ?? null;

  return (
    <div className="relative select-none">
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-64 flex-col justify-between" style={{ paddingTop: `${(T / H) * 256 - 6}px`, paddingBottom: `${(B / H) * 256 - 6}px` }}>
        {[1, 0.75, 0.5, 0.25, 0].map((f) => (
          <div key={f} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-faint">{fmt(max * f)}</span>
            <span className="h-px flex-1 border-t border-dashed border-line" />
          </div>
        ))}
      </div>
      <div className="ml-16">
        <div className="relative h-64">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
          }}
          role="img"
          aria-label={`${metricLabel} over time`}
        >
          <defs>
            <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {prev.length > 0 && <path d={path(prev)} fill="none" stroke="var(--faint)" strokeWidth={1.5} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />}
          {n > 0 && <path d={`${path(values)}L${x(n - 1)},${H - B}L${x(0)},${H - B}Z`} fill="url(#area)" />}
          <path d={path(values)} fill="none" stroke="var(--accent)" strokeWidth={2.25} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {h !== null && points[h] && <line x1={x(h)} x2={x(h)} y1={T} y2={H - B} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />}
        </svg>
        {h !== null && points[h] && (
          <>
            <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel bg-accent shadow" style={{ left: `${(x(h) / W) * 100}%`, top: `${(y(points[h].value) / H) * 100}%` }} />
            <div
              className="popover pointer-events-none absolute top-0 z-10 min-w-44 px-3 py-2 text-xs"
              style={{ left: `${(x(h) / W) * 100}%`, transform: `translateX(${x(h) / W > 0.7 ? "-105%" : "8%"})` }}
            >
              <p className="font-medium">{label(points[h].bucket, interval, true)}</p>
              <p className="mt-1.5 flex items-center justify-between gap-4"><span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full bg-accent" />{metricLabel}</span><b className="tabular-nums">{fmt(points[h].value)}</b></p>
              {prev[h] !== undefined && <p className="mt-1 flex items-center justify-between gap-4 text-muted"><span className="flex items-center gap-1.5"><span className="h-0.5 w-2 bg-faint" />Previous</span><span className="tabular-nums">{fmt(prev[h]!)}</span></p>}
            </div>
          </>
        )}
        </div>
        <div className="relative mt-1 h-4 text-[11px] text-faint">
          {points.map((p, i) => (i % tickEvery === 0 ? (
            <span key={p.bucket} className={`absolute -translate-x-1/2 whitespace-nowrap ${(i / tickEvery) % 2 ? "hidden sm:inline" : ""}`} style={{ left: `${(x(i) / W) * 100}%` }}>{label(p.bucket, interval)}</span>
          ) : null))}
        </div>
      </div>
    </div>
  );
}
