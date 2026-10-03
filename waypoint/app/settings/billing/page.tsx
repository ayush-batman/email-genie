import { AlertTriangle, Check, CreditCard, Sparkles } from "lucide-react";
import { requireOrg } from "@/lib/auth.ts";
import { sql } from "@/lib/db.ts";
import { billingConfigured, limits, monthEvents } from "@/lib/billing.ts";
import { accessState, OVERAGE_HARD_LIMIT, PAID, PLANS, TRIAL_GRACE_DAYS, type PlanId } from "@/lib/plans.ts";
import { compact } from "@/lib/format.ts";
import { openBillingPortal, startCheckout } from "../../actions.ts";

export const metadata = { title: "Billing" };

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const share = limit ? used / limit : 0;
  const tone = share >= 1 ? "bg-bad" : share >= 0.8 ? "bg-warn" : "bg-accent";
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="font-medium">{label}</span><span className="tabular-nums text-muted">{compact(used)} / {compact(limit)}</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-subtle"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, share * 100)}%` }} /></div>
    </div>
  );
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ upgraded?: string; error?: string }> }) {
  const sp = await searchParams;
  const { org, role } = await requireOrg();
  const manager = role === "owner" || role === "admin";
  const [o] = await sql<{ plan: PlanId; trial_ends_at: Date; subscription_status: string | null; stripe_customer_id: string | null; current_period_end: Date | null }[]>`
    SELECT plan, trial_ends_at, subscription_status, stripe_customer_id, current_period_end FROM organizations WHERE id = ${org.id}`;
  const [usage, lim] = await Promise.all([monthEvents(org.id), limits(org.id)]);
  const state = accessState(o!);
  const plan = lim.plan;
  const daysLeft = Math.ceil((o!.trial_ends_at.getTime() - Date.now()) / 86_400_000);
  const configured = billingConfigured();

  return (
    <div className="space-y-5">
      {sp.upgraded && <div className="flex items-center gap-2 rounded-xl border border-good/30 bg-good-soft p-4 text-sm text-good"><Check className="h-4 w-4" /> Thanks! Your subscription is active. It can take a few seconds to show here.</div>}
      {sp.error === "not_configured" && <div className="rounded-xl border border-warn/30 bg-warn-soft p-4 text-sm">Billing isn&apos;t configured on this server yet (set STRIPE_SECRET_KEY and the STRIPE_PRICE_* variables).</div>}
      {(state === "trial_expired" || state === "canceled") && (
        <div className="flex gap-3 rounded-xl border border-bad/30 bg-bad-soft p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
          <p>{state === "trial_expired" ? <>Your trial has ended. Dashboards are paused; we keep collecting data for {TRIAL_GRACE_DAYS} days after the trial so nothing is lost while you pick a plan.</> : <>Your subscription is canceled, so dashboards and tracking are paused. Your data is kept. Choose a plan to pick up where you left off.</>}</p>
        </div>
      )}

      <section className="panel grid gap-6 p-6 md:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Current plan</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{plan.name}</p>
          <p className="mt-1 text-sm text-muted">
            {state === "trial" ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your trial. No card on file.`
              : state === "trial_expired" ? "Trial ended."
              : state === "past_due" ? "Payment failed. Stripe will retry; update your card to avoid interruption."
              : state === "canceled" ? "Canceled."
              : `$${plan.price}/month${o!.current_period_end ? ` · renews ${o!.current_period_end.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}` : ""}`}
          </p>
          {manager && o!.stripe_customer_id && configured && (
            <form action={openBillingPortal} className="mt-4"><button className="btn-ghost"><CreditCard className="h-4 w-4" /> Manage billing & invoices</button></form>
          )}
        </div>
        <div className="space-y-4">
          <Meter label="Events this month" used={usage.total} limit={plan.events} />
          <Meter label="Websites" used={lim.sites} limit={plan.websites} />
          <Meter label="Team members (incl. pending invites)" used={lim.members} limit={plan.members} />
          <p className="text-xs text-muted">Events count pageviews and custom events. Going over is fine for a while: we email you at 80% and 100%, and only pause tracking at {Math.round(OVERAGE_HARD_LIMIT * 100)}% so your site never breaks.</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">{state === "active" || state === "past_due" ? "Change plan" : "Choose a plan"}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PAID.map((id) => {
            const p = PLANS[id];
            const current = o!.plan === id && (state === "active" || state === "past_due");
            return (
              <div key={id} className={`panel flex flex-col p-5 ${id === "growth" ? "ring-2 ring-accent" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{p.name}</p>
                  {id === "growth" && <span className="chip bg-accent-soft text-accent"><Sparkles className="h-3 w-3" /> Popular</span>}
                </div>
                <p className="mt-2"><span className="text-3xl font-semibold tracking-tight">${p.price}</span><span className="text-sm text-muted">/month</span></p>
                <p className="mt-1 text-xs text-muted">{p.blurb}</p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-good" />{f}</li>)}</ul>
                {current ? <span className="btn-ghost mt-5 pointer-events-none">Current plan</span>
                  : !manager ? <span className="mt-5 text-center text-xs text-muted">Ask an owner or admin to change plans</span>
                  : o!.stripe_customer_id && (state === "active" || state === "past_due")
                    ? <form action={openBillingPortal} className="mt-5"><button className="btn-ghost w-full">Switch in billing portal</button></form>
                    : <form action={startCheckout.bind(null, id)} className="mt-5"><button className={`${id === "growth" ? "btn" : "btn-ghost"} w-full`} disabled={!configured}>Choose {p.name}</button></form>}
              </div>
            );
          })}
        </div>
        {!configured && <p className="mt-3 text-xs text-muted">Payments are disabled on this server (no STRIPE_SECRET_KEY).</p>}
      </section>
    </div>
  );
}
