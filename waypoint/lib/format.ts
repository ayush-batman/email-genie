export function compact(n: number) {
  return Intl.NumberFormat("en", { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}
export function pct(n: number) {
  return `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`;
}
export function duration(s: number) {
  const m = Math.floor(s / 60);
  return m ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
}
export function money(minor: number, currency = "USD") {
  const zeroDecimal = ["JPY", "KRW"].includes(currency);
  const major = zeroDecimal ? minor : minor / 100;
  const whole = zeroDecimal || Math.abs(major) >= 1000 || Number.isInteger(major);
  return Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(major);
}
export function flag(cc: string) {
  return /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐";
}
const REGION = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(cc: string) {
  try {
    return REGION.of(cc) ?? cc;
  } catch {
    return cc;
  }
}
/** "2026-10-03 19:31:03.772" (UTC from ClickHouse) → Date */
export function chDate(s: string) {
  return new Date(s.replace(" ", "T") + "Z");
}
export function ago(d: Date, now = Date.now()) {
  const s = Math.round((now - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 30 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}
