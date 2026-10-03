import { z } from "zod";

/** Dimensions available for breakdowns and filters. Maps to ClickHouse columns. */
export const DIMENSIONS = {
  channel: { label: "Channel", column: "channel" },
  referrer: { label: "Referrer", column: "referrer_domain" },
  utm_source: { label: "UTM Source", column: "utm_source" },
  utm_medium: { label: "UTM Medium", column: "utm_medium" },
  utm_campaign: { label: "UTM Campaign", column: "utm_campaign" },
  utm_term: { label: "UTM Term", column: "utm_term" },
  utm_content: { label: "UTM Content", column: "utm_content" },
  page: { label: "Page", column: "url_path" },
  entry_page: { label: "Entry page", column: "entry_path", session: true },
  exit_page: { label: "Exit page", column: "exit_path", session: true },
  title: { label: "Page title", column: "title" },
  hostname: { label: "Hostname", column: "hostname" },
  country: { label: "Country", column: "country" },
  region: { label: "Region", column: "region" },
  city: { label: "City", column: "city" },
  device: { label: "Device", column: "device" },
  browser: { label: "Browser", column: "browser" },
  os: { label: "OS", column: "os" },
  screen: { label: "Screen", column: "screen_bucket" },
  language: { label: "Language", column: "language" },
  event: { label: "Event", column: "name" },
} as const satisfies Record<string, { label: string; column: string; session?: boolean }>;

export type Dimension = keyof typeof DIMENSIONS;
export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as Dimension[];

export const FILTER_OPS = ["is", "is_not", "contains", "not_contains"] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export const filterSchema = z.object({
  dim: z.enum(DIMENSION_KEYS as [Dimension, ...Dimension[]]),
  op: z.enum(FILTER_OPS),
  value: z.string().max(512),
});
export type Filter = z.infer<typeof filterSchema>;

export const PERIODS = ["realtime", "today", "yesterday", "7d", "30d", "90d", "month", "last_month", "ytd", "12mo", "all", "custom"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  realtime: "Last 30 minutes",
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month: "This month",
  last_month: "Last month",
  ytd: "Year to date",
  "12mo": "Last 12 months",
  all: "All time",
  custom: "Custom range",
};

export type Interval = "minute" | "hour" | "day" | "week" | "month";

export interface DateRange {
  from: Date; // inclusive, UTC instant
  to: Date; // exclusive, UTC instant
  interval: Interval;
}

export const METRICS = ["visitors", "visits", "pageviews", "views_per_visit", "bounce_rate", "visit_duration", "events", "revenue", "conversion_rate", "revenue_per_visitor"] as const;
export type Metric = (typeof METRICS)[number];

/** Serialize filters for URLs: dim:op:value joined by "|" (value is URI-encoded). */
export function encodeFilters(filters: Filter[]): string {
  return filters.map((f) => `${f.dim}:${f.op}:${encodeURIComponent(f.value)}`).join("|");
}

export function decodeFilters(raw: string | null | undefined): Filter[] {
  if (!raw) return [];
  const out: Filter[] = [];
  for (const part of raw.split("|")) {
    const [dim, op, ...rest] = part.split(":");
    const parsed = filterSchema.safeParse({ dim, op, value: decodeURIComponent(rest.join(":")) });
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
