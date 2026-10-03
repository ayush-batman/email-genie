import { sql } from "@/lib/db.ts";
import { decrypt } from "@/lib/crypto.ts";
import { parseWebhook, PROVIDERS, verifySignature, type Provider } from "@/lib/payments.ts";
import { recordPayment, rememberCustomers } from "@/lib/revenue.ts";

// Payment provider webhooks: /api/webhooks/{stripe|lemonsqueezy|polar|paddle}/{siteId}
export async function POST(req: Request, { params }: { params: Promise<{ provider: string; siteId: string }> }) {
  const { provider, siteId } = await params;
  if (!(PROVIDERS as readonly string[]).includes(provider) || !/^[0-9a-f-]{36}$/i.test(siteId)) return new Response("not found", { status: 404 });
  const [conn] = await sql<{ secret_enc: string }[]>`SELECT secret_enc FROM revenue_connections WHERE site_id = ${siteId} AND provider = ${provider}`;
  if (!conn) return new Response("not connected", { status: 404 });

  const body = await req.text(); // raw body: signatures are over the exact bytes
  if (!verifySignature(provider as Provider, decrypt(conn.secret_enc), body, req.headers)) return new Response("invalid signature", { status: 400 });

  try {
    const { payments, links } = parseWebhook(provider as Provider, body, req.headers);
    await rememberCustomers(siteId, provider, links);
    let recorded = 0;
    for (const p of payments) if (await recordPayment(siteId, provider, p)) recorded++;
    return Response.json({ received: true, recorded });
  } catch (err) {
    console.error(`${provider} webhook failed`, err);
    return new Response("processing failed", { status: 500 }); // provider retries
  }
}
