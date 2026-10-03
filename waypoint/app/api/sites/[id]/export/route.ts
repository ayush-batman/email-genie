import { requireSite } from "@/lib/auth.ts";
import { decodeFilters, DIMENSIONS, PERIODS, type Dimension, type Period } from "@/lib/query.ts";
import { resolvePeriod } from "@/lib/dates.ts";
import { exportBreakdown } from "@/lib/stats.ts";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { site } = await requireSite((await params).id);
  const q = new URL(req.url).searchParams;
  const dim = q.get("dim") ?? "";
  if (!(dim in DIMENSIONS)) return new Response("unknown dimension", { status: 400 });
  const period = (PERIODS as readonly string[]).includes(q.get("period") ?? "") ? (q.get("period") as Period) : "30d";
  const range = resolvePeriod(period, site.timezone, { from: q.get("from") ?? "", to: q.get("to") ?? "" });
  const csv = await exportBreakdown({ siteId: site.id, tz: site.timezone, range, filters: decodeFilters(q.get("f")) }, dim as Dimension);
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${site.domain}-${dim}-${period}.csv"` },
  });
}
