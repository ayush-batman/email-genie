// MCP server over Streamable HTTP (stateless, JSON responses). Auth: Authorization: Bearer wp_live_… (team API key).
import { z } from "zod";
import { authenticate, runTool, ToolError, TOOLS, type ApiContext } from "@/lib/tools.ts";

const SUPPORTED = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const INSTRUCTIONS = `Waypoint web analytics. Start with list_sites to get a site_id. Periods are presets (today, 7d, 30d, 90d, month, last_month, ytd, 12mo, all) or from/to dates, in the site's timezone. Revenue amounts are integers in minor units (cents) of the site currency. Filters use dim:op:value joined by |.`;

async function handle(msg: Rpc, ctx: ApiContext) {
  switch (msg.method) {
    case "initialize": {
      const requested = String(msg.params?.protocolVersion ?? "");
      return {
        protocolVersion: SUPPORTED.includes(requested) ? requested : SUPPORTED[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "waypoint", title: "Waypoint Analytics", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: z.toJSONSchema(t.input, { io: "input" }),
          annotations: { readOnlyHint: true, openWorldHint: false },
        })),
      };
    case "tools/call": {
      const t = TOOLS.find((x) => x.name === msg.params?.name);
      if (!t) throw Object.assign(new Error(`Unknown tool: ${String(msg.params?.name)}`), { code: -32602 });
      try {
        const result = await runTool(t, ctx, msg.params?.arguments);
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result as Record<string, unknown> };
      } catch (e) {
        // Tool errors go back to the model as results so it can correct itself.
        if (e instanceof ToolError) return { content: [{ type: "text", text: e.message }], isError: true };
        throw e;
      }
    }
    default:
      throw Object.assign(new Error(`Method not found: ${msg.method}`), { code: -32601 });
  }
}

export async function POST(req: Request) {
  const ctx = await authenticate(req);
  if (!ctx)
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized: pass Authorization: Bearer wp_live_…" } }, { status: 401, headers: { "www-authenticate": 'Bearer realm="waypoint"' } });
  let body: Rpc | Rpc[];
  try { body = await req.json(); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 }); }

  const one = async (m: Rpc) => {
    if (m.id === undefined || m.id === null) return null; // notification (e.g. notifications/initialized)
    try {
      return { jsonrpc: "2.0", id: m.id, result: await handle(m, ctx) };
    } catch (e) {
      const code = (e as { code?: number }).code ?? -32603;
      if (code === -32603) console.error("mcp error", e);
      return { jsonrpc: "2.0", id: m.id, error: { code, message: code === -32603 ? "Internal error" : (e as Error).message } };
    }
  };
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(one))).filter(Boolean);
    return out.length ? Response.json(out) : new Response(null, { status: 202 });
  }
  const res = await one(body);
  return res ? Response.json(res) : new Response(null, { status: 202 });
}

// No server-initiated stream: this server only answers requests.
export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
}
export const DELETE = GET;
