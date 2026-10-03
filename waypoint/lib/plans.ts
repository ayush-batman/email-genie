// Single source of truth for plans: used by the pricing page, billing page, and limit enforcement.
// TODO(pricing): prices are placeholders until the real price list is decided; Stripe price ids come from env.
export type PlanId = "trial" | "starter" | "growth" | "business";

export type Plan = { id: PlanId; name: string; price: number; websites: number; events: number; members: number; blurb: string; features: string[] };

export const PLANS: Record<PlanId, Plan> = {
  trial: { id: "trial", name: "Free trial", price: 0, websites: 10, events: 1_000_000, members: 10, blurb: "Everything, for 7 days", features: [] },
  starter: {
    id: "starter", name: "Starter", price: 9, websites: 3, events: 100_000, members: 2, blurb: "For a side project or a new launch",
    features: ["3 websites", "100k events / month", "2 team members", "Revenue attribution", "Funnels & goals", "API & MCP access"],
  },
  growth: {
    id: "growth", name: "Growth", price: 29, websites: 10, events: 1_000_000, members: 10, blurb: "For a growing product with a team",
    features: ["10 websites", "1M events / month", "10 team members", "Everything in Starter", "Data imports", "Email reports"],
  },
  business: {
    id: "business", name: "Business", price: 99, websites: 50, events: 10_000_000, members: 50, blurb: "For portfolios and agencies",
    features: ["50 websites", "10M events / month", "50 team members", "Everything in Growth", "Priority support"],
  },
};

export const PAID: Exclude<PlanId, "trial">[] = ["starter", "growth", "business"];
export const TRIAL_GRACE_DAYS = 14; // tracking continues this long after a trial ends without payment
export const OVERAGE_HARD_LIMIT = 1.2; // ingest stops at 120% of the monthly event allowance

export const priceIdFor = (plan: PlanId) => process.env[`STRIPE_PRICE_${plan.toUpperCase()}`] ?? "";
export const planForPrice = (priceId: string): PlanId | null => PAID.find((p) => priceIdFor(p) === priceId) ?? null;

export type OrgBilling = { plan: string; trial_ends_at: Date; subscription_status: string | null };

/** Whether the dashboard is usable. Trials lock after they end; paid plans lock when the subscription is canceled or unpaid. */
export function accessState(o: OrgBilling, now = Date.now()): "trial" | "active" | "trial_expired" | "past_due" | "canceled" {
  if (o.plan === "trial") return o.trial_ends_at.getTime() > now ? "trial" : "trial_expired";
  if (o.subscription_status === "past_due") return "past_due"; // still usable while Stripe retries
  if (o.subscription_status === "canceled" || o.subscription_status === "unpaid") return "canceled";
  return "active";
}

/** Whether new events should still be accepted for this org. */
export function canIngest(o: OrgBilling, monthEvents: number, now = Date.now()): boolean {
  const state = accessState(o, now);
  if (state === "trial_expired") return o.trial_ends_at.getTime() + TRIAL_GRACE_DAYS * 86_400_000 > now;
  if (state === "canceled") return false;
  const plan = PLANS[(o.plan as PlanId) in PLANS ? (o.plan as PlanId) : "trial"];
  return monthEvents < plan.events * OVERAGE_HARD_LIMIT;
}
