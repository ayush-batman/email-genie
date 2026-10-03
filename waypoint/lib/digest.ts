// Weekly/monthly email digest: headline numbers vs the previous period, top sources and pages.
import { sql, type Site } from "./db.ts";
import { kpis, breakdown, type Scope } from "./stats.ts";
import { formatYmd, zonedYmd, resolvePeriod } from "./dates.ts";
import { compact, money, pct } from "./format.ts";
import { esc, layout, sendEmail } from "./email.ts";

export async function buildDigest(site: Site, frequency: "weekly" | "monthly", appUrl: string) {
  const now = new Date();
  const days = frequency === "weekly" ? 7 : 30;
  const end = resolvePeriod("today", site.timezone, { now }).from; // up to the start of today
  const range = { from: new Date(end.getTime() - days * 86_400_000), to: end, interval: "day" as const };
  const prev = { from: new Date(range.from.getTime() - days * 86_400_000), to: range.from, interval: "day" as const };
  const scope: Scope = { siteId: site.id, tz: site.timezone, range, filters: [], currency: site.currency };
  const [cur, before, sources, pages] = await Promise.all([kpis(scope), kpis({ ...scope, range: prev }), breakdown(scope, "channel", 5), breakdown(scope, "page", 5)]);
  const delta = (a: number, b: number) => (b ? `${a >= b ? "▲" : "▼"} ${pct(Math.abs(a - b) / b)}` : "");
  const label = `${formatYmd(zonedYmd(range.from, site.timezone))} – ${formatYmd(zonedYmd(new Date(end.getTime() - 1), site.timezone))}`;
  const stat = (k: string, v: string, d: string) => `<td style="padding:12px;border:1px solid #e8e7e3;border-radius:10px"><div style="font-size:12px;color:#63636b">${k}</div><div style="font-size:20px;font-weight:600">${v}</div><div style="font-size:12px;color:#63636b">${d}</div></td>`;
  const list = (rows: { value: string; visitors: number }[], empty: string) =>
    rows.map((r) => `<tr><td style="padding:4px 0">${esc(r.value || empty)}</td><td align="right" style="padding:4px 0">${compact(r.visitors)}</td></tr>`).join("");
  const body = `<p style="margin:0 0 16px;color:#63636b">${esc(site.domain)} · ${label}</p>
<table width="100%" cellspacing="8" cellpadding="0" style="margin:0 -8px"><tr>
${stat("Visitors", compact(cur.visitors), delta(cur.visitors, before.visitors))}
${stat("Pageviews", compact(cur.pageviews), delta(cur.pageviews, before.pageviews))}
${stat("Revenue", money(cur.revenue, site.currency), delta(cur.revenue, before.revenue))}
</tr></table>
<h3 style="font-size:14px;margin:24px 0 8px">Top sources</h3><table width="100%" style="font-size:14px">${list(sources, "Direct / none")}</table>
<h3 style="font-size:14px;margin:24px 0 8px">Top pages</h3><table width="100%" style="font-size:14px">${list(pages, "/")}</table>`;
  const text = `${site.domain} ${label}\nVisitors ${compact(cur.visitors)} ${delta(cur.visitors, before.visitors)}\nPageviews ${compact(cur.pageviews)}\nRevenue ${money(cur.revenue, site.currency)}\nTop sources: ${sources.map((s) => `${s.value || "Direct"} ${s.visitors}`).join(", ")}`;
  return { subject: `${site.name}: ${compact(cur.visitors)} visitors ${frequency === "weekly" ? "this week" : "this month"}`, html: layout(`Your ${frequency} report`, body, { href: `${appUrl}/sites/${site.id}`, label: "Open dashboard" }), text };
}

/** Sends every digest that's due. Called by the cron endpoint. */
export async function sendDueDigests(appUrl: string): Promise<number> {
  const due = await sql<(Site & { email: string; frequency: "weekly" | "monthly"; user_id: string })[]>`
    SELECT s.*, u.email, r.frequency, r.user_id FROM email_reports r
    JOIN sites s ON s.id = r.site_id JOIN users u ON u.id = r.user_id
    JOIN memberships m ON m.org_id = s.org_id AND m.user_id = u.id
    WHERE r.last_sent_at IS NULL
       OR (r.frequency = 'weekly' AND r.last_sent_at < now() - interval '7 days')
       OR (r.frequency = 'monthly' AND r.last_sent_at < now() - interval '1 month')`;
  for (const d of due) {
    const { email, frequency, user_id, ...site } = d;
    await sendEmail({ to: email, ...(await buildDigest(site, frequency, appUrl)) });
    await sql`UPDATE email_reports SET last_sent_at = now() WHERE site_id = ${site.id} AND user_id = ${user_id}`;
  }
  return due.length;
}
