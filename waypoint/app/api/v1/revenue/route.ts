import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db.ts";
import { decrypt } from "@/lib/crypto.ts";
import { recordPayment } from "@/lib/revenue.ts";

// Server-side revenue from any backend: POST /api/v1/revenue with "Authorization: Bearer wp_sk_..."
const schema = z
  .object({
    site_id: z.string().min(1),
    amount: z.number().int().positive(), // minor units (cents)
    currency: z.string().length(3),
    order_id: z.string().min(1).max(200),
    type: z.enum(["payment", "renewal", "refund"]).default("payment"),
    visitor_id: z.string().max(64).optional(),
    session_id: z.string().max(64).optional(),
    user_id: z.string().max(256).optional(),
    customer_id: z.string().max(200).optional(),
    occurred_at: z.string().datetime().optional(),
  })
  .refine((b) => b.visitor_id || b.session_id || b.user_id || b.customer_id, { message: "one of visitor_id, session_id, user_id or customer_id is required" });

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: { code: "invalid_json", message: "Body must be JSON" } }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: { code: "invalid_request", message: parsed.error.issues[0]?.message } }, { status: 400 });
  const b = parsed.data;

  const [conn] = await sql<{ site_id: string; secret_enc: string }[]>`
    SELECT c.site_id, c.secret_enc FROM revenue_connections c JOIN sites s ON s.id = c.site_id
    WHERE c.provider = 'api' AND (s.public_id = ${b.site_id} OR s.id::text = ${b.site_id})`;
  const secret = conn ? Buffer.from(decrypt(conn.secret_enc)) : null;
  if (!conn || !secret || secret.length !== Buffer.byteLength(token) || !timingSafeEqual(secret, Buffer.from(token)))
    return Response.json({ error: { code: "unauthorized", message: "Invalid API key for this site" } }, { status: 401 });

  const recorded = await recordPayment(conn.site_id, "api", {
    eventId: `${b.type}:${b.order_id}:${b.type === "refund" ? b.amount : ""}`,
    kind: b.type,
    amount: b.amount,
    currency: b.currency.toUpperCase(),
    orderId: b.order_id,
    customerId: b.customer_id ?? "",
    visitorId: b.visitor_id ?? "",
    userId: b.user_id ?? "",
    sessionId: b.session_id ?? "",
    at: b.occurred_at ? new Date(b.occurred_at) : new Date(),
  });
  return Response.json({ recorded }, { status: recorded ? 201 : 200 });
}
