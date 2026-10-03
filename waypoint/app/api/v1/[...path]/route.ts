import { z } from "zod";
import { authenticate, runTool, ToolError, TOOLS } from "@/lib/tools.ts";

const err = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

/** GET /api/v1/... → the tool whose path template matches. Path params and query params become tool input. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.join("/") === "openapi.json") return Response.json(openapi(new URL(req.url).origin));
  const ctx = await authenticate(req);
  if (!ctx) return err(401, "unauthorized", "Pass an API key: Authorization: Bearer wp_live_…");

  for (const t of TOOLS) {
    const tpl = t.path.split("/").filter(Boolean);
    if (tpl.length !== parts.length) continue;
    const input: Record<string, unknown> = {};
    if (!tpl.every((seg, i) => (seg.startsWith("{") ? ((input[seg.slice(1, -1)] = decodeURIComponent(parts[i]!)), true) : seg === parts[i]))) continue;
    for (const [k, v] of new URL(req.url).searchParams) input[k] = v;
    try {
      return Response.json(await runTool(t, ctx, input));
    } catch (e) {
      if (e instanceof ToolError) return err(e.status, e.status === 404 ? "not_found" : "invalid_request", e.message);
      console.error("api error", e);
      return err(500, "internal", "Something went wrong");
    }
  }
  return err(404, "not_found", `No endpoint ${parts.join("/")}. See /api/v1/openapi.json`);
}

function openapi(origin: string) {
  const paths: Record<string, unknown> = {};
  for (const t of TOOLS) {
    const schema = z.toJSONSchema(t.input) as { properties?: Record<string, { description?: string } & Record<string, unknown>>; required?: string[] };
    const pathParams = [...t.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
    paths[`/api/v1${t.path}`] = {
      get: {
        operationId: t.name,
        summary: t.description,
        security: [{ bearer: [] }],
        parameters: Object.entries(schema.properties ?? {})
          .filter(([, s]) => s.type !== "array")
          .map(([name, s]) => ({ name, in: pathParams.includes(name) ? "path" : "query", required: pathParams.includes(name) || (schema.required ?? []).includes(name) && !("default" in s), description: s.description, schema: s })),
        responses: { 200: { description: "OK" }, 401: { description: "Missing or invalid API key" }, 404: { description: "Not found" } },
      },
    };
  }
  paths["/api/v1/revenue"] = { post: { operationId: "record_revenue", summary: "Record a payment from your backend (site API key from Settings → Revenue).", responses: { 201: { description: "Recorded" } } } };
  return {
    openapi: "3.1.0",
    info: { title: "Waypoint API", version: "1.0.0", description: "Read-only analytics API. Amounts are in minor units of the site currency." },
    servers: [{ url: origin }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Team API key (wp_live_…)" } } },
    paths,
  };
}
