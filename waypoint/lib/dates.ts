import type { DateRange, Interval, Period } from "./query.ts";

const DAY = 86_400_000;

/** Offset (ms) of `tz` from UTC at instant `at`. Positive east of UTC. */
export function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Wall-clock Y/M/D in `tz` for instant `at`. */
export function zonedYmd(at: Date, tz: string): { y: number; m: number; d: number } {
  const local = new Date(at.getTime() + tzOffsetMs(at, tz));
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate() };
}

/** The UTC instant at which wall-clock midnight of y-m-d occurs in `tz`. */
export function zonedMidnight(y: number, m: number, d: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d);
  const off1 = tzOffsetMs(new Date(guess), tz);
  const off2 = tzOffsetMs(new Date(guess - off1), tz);
  return new Date(guess - off2);
}

function addDays(y: number, m: number, d: number, n: number) {
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function pickInterval(from: Date, to: Date): Interval {
  const span = to.getTime() - from.getTime();
  if (span <= 2 * 3600_000) return "minute";
  if (span <= 2 * DAY) return "hour";
  if (span <= 120 * DAY) return "day";
  if (span <= 400 * DAY) return "week";
  return "month";
}

export function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function formatYmd(p: { y: number; m: number; d: number }): string {
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/**
 * Resolve a period preset into an absolute [from, to) range in the site's timezone.
 * `firstEventAt` is used for "all".
 */
export function resolvePeriod(
  period: Period,
  tz: string,
  opts: { now?: Date; from?: string; to?: string; firstEventAt?: Date | null } = {},
): DateRange {
  const now = opts.now ?? new Date();
  const today = zonedYmd(now, tz);
  const startOf = (p: { y: number; m: number; d: number }) => zonedMidnight(p.y, p.m, p.d, tz);
  const tomorrow = startOf(addDays(today.y, today.m, today.d, 1));
  let from: Date;
  let to: Date = tomorrow;

  switch (period) {
    case "realtime":
      from = new Date(now.getTime() - 30 * 60_000);
      to = new Date(now.getTime() + 60_000);
      return { from, to, interval: "minute" };
    case "today":
      from = startOf(today);
      return { from, to, interval: "hour" };
    case "yesterday":
      to = startOf(today);
      from = startOf(addDays(today.y, today.m, today.d, -1));
      return { from, to, interval: "hour" };
    case "7d":
      from = startOf(addDays(today.y, today.m, today.d, -6));
      break;
    case "30d":
      from = startOf(addDays(today.y, today.m, today.d, -29));
      break;
    case "90d":
      from = startOf(addDays(today.y, today.m, today.d, -89));
      break;
    case "month":
      from = startOf({ y: today.y, m: today.m, d: 1 });
      break;
    case "last_month": {
      const lm = today.m === 1 ? { y: today.y - 1, m: 12 } : { y: today.y, m: today.m - 1 };
      from = startOf({ ...lm, d: 1 });
      to = startOf({ y: today.y, m: today.m, d: 1 });
      break;
    }
    case "ytd":
      from = startOf({ y: today.y, m: 1, d: 1 });
      break;
    case "12mo":
      from = startOf({ y: today.y - 1, m: today.m, d: 1 });
      break;
    case "all": {
      const first = opts.firstEventAt ?? new Date(now.getTime() - 30 * DAY);
      const f = zonedYmd(first, tz);
      from = startOf(f);
      break;
    }
    case "custom": {
      const f = parseYmd(opts.from ?? "");
      const t = parseYmd(opts.to ?? "");
      if (!f || !t) return resolvePeriod("30d", tz, opts);
      from = startOf(f);
      to = startOf(addDays(t.y, t.m, t.d, 1));
      if (to <= from) to = new Date(from.getTime() + DAY);
      break;
    }
  }
  return { from, to, interval: pickInterval(from, to) };
}

/** The range immediately before `range`, of equal length. */
export function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: new Date(range.from.getTime()), interval: range.interval };
}
