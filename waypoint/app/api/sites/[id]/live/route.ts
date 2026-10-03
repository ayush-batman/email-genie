import { requireSite } from "@/lib/auth.ts";
import { liveFeed, onlineNow } from "@/lib/stats.ts";

// Server-Sent Events: pushes online count + new events every 2s.
// ponytail: polls ClickHouse per open connection; switch to Redis pub/sub when many dashboards are open at once.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { site } = await requireSite((await params).id);
  const enc = new TextEncoder();
  let since = "";
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const tick = async () => {
        try {
          const [online, feed] = await Promise.all([onlineNow(site.id), liveFeed(site.id, since || undefined, since ? 100 : 30)]);
          if (feed[0]) since = feed[0].time;
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ online, events: feed })}\n\n`));
        } catch (err) {
          console.error("live tick failed", err);
        }
        if (!req.signal.aborted) timer = setTimeout(tick, 2000);
      };
      req.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        try { controller.close(); } catch {}
      });
      await tick();
    },
    cancel() {
      clearTimeout(timer);
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
