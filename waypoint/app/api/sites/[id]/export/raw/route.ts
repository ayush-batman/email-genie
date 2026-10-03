import { requireSite } from "@/lib/auth.ts";
import { ch } from "@/lib/db.ts";

// Every event for the site, streamed straight from ClickHouse as CSV or NDJSON.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { site } = await requireSite((await params).id);
  const ndjson = new URL(req.url).searchParams.get("format") === "ndjson";
  const rs = await ch.query({
    query: "SELECT * EXCEPT (site_id) FROM events WHERE site_id = {site:UUID} ORDER BY ts",
    query_params: { site: site.id },
    format: ndjson ? "JSONEachRow" : "CSVWithNames",
  });
  const stream = rs.stream() as unknown as AsyncIterable<{ text: string }[]>;
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      for await (const rows of stream) for (const r of rows) controller.enqueue(enc.encode(r.text + "\n"));
      controller.close();
    },
  });
  const ext = ndjson ? "ndjson" : "csv";
  return new Response(body, {
    headers: { "content-type": ndjson ? "application/x-ndjson" : "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${site.domain}-all-events.${ext}"` },
  });
}
