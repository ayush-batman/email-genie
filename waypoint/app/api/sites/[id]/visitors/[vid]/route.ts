import { requireSite } from "@/lib/auth.ts";
import { exportVisitor } from "@/lib/visitors.ts";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; vid: string }> }) {
  const { id, vid } = await params;
  const { site } = await requireSite(id);
  const rows = await exportVisitor(site.id, decodeURIComponent(vid));
  return new Response(JSON.stringify({ site: site.domain, exported_at: new Date().toISOString(), events: rows }, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="visitor-${vid.slice(0, 12)}.json"` },
  });
}
