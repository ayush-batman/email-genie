import { sql } from "@/lib/db.ts";
import { audit } from "@/lib/auth.ts";
import { verifySignature } from "@/lib/payments.ts";
import { planForPrice } from "@/lib/plans.ts";

// Stripe → subscription state for Waypoint's own billing (separate from customers' revenue webhooks).
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await req.text();
  if (!secret || !verifySignature("stripe", secret, body, req.headers)) return new Response("invalid signature", { status: 400 });
  const e = JSON.parse(body) as { type: string; data: { object: Record<string, any> } }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const o = e.data.object;

  if (e.type === "checkout.session.completed" && o.mode === "subscription" && o.client_reference_id) {
    await sql`UPDATE organizations SET stripe_customer_id = ${o.customer}, stripe_subscription_id = ${o.subscription}, subscription_status = 'active'
              WHERE id = ${o.client_reference_id}`;
  }
  if (e.type.startsWith("customer.subscription.")) {
    const plan = planForPrice(o.items?.data?.[0]?.price?.id ?? "");
    const status = e.type === "customer.subscription.deleted" ? "canceled" : String(o.status);
    const periodEnd = o.items?.data?.[0]?.current_period_end ?? o.current_period_end;
    const [org] = await sql<{ id: string; plan: string }[]>`
      UPDATE organizations SET subscription_status = ${status}, stripe_subscription_id = ${o.id}, stripe_customer_id = ${o.customer},
        plan = COALESCE(${status === "canceled" ? null : plan}, plan), current_period_end = ${periodEnd ? new Date(periodEnd * 1000) : null}
      WHERE stripe_customer_id = ${o.customer} OR id::text = ${o.metadata?.org_id ?? ""} RETURNING id, plan`;
    if (org) await audit(org.id, null, "billing.subscription_" + e.type.split(".").pop(), `${org.plan} · ${status}`);
  }
  return Response.json({ received: true });
}
