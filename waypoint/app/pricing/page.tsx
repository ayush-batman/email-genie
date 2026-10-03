import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { PAID, PLANS } from "@/lib/plans.ts";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-header.tsx";

export const metadata = { title: "Pricing", description: "Simple plans for founders and small teams. Every plan includes revenue attribution, funnels and the MCP server." };

const FAQ = [
  ["What counts as an event?", "Every pageview and custom event. Engagement pings, payments and imported history don't count toward your monthly limit."],
  ["What happens if I go over?", "Nothing breaks. We email you at 80% and 100% and keep tracking up to 120% of your plan. After that, new events pause until the next month or until you upgrade."],
  ["What happens when the trial ends?", "Dashboards pause until you pick a plan, but we keep collecting data for 14 days so there's no gap in your history."],
  ["Do I need a cookie banner?", "Not in Private mode, which stores nothing on visitors' devices. Product mode uses first-party storage to recognise returning visitors, which may need consent depending on where you operate."],
  ["Can I import my old analytics?", "Yes: Umami, Databuddy and Vercel Analytics exports import in a few clicks, and you can remove an import at any time."],
  ["Can I cancel anytime?", "Yes, from the billing portal. Your data stays available to export."],
];

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Simple pricing</h1>
          <p className="mt-4 text-lg text-muted">Every plan includes every feature. Pick by traffic and team size. Start with a 7-day free trial, no card required.</p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {PAID.map((id) => {
            const p = PLANS[id];
            const popular = id === "growth";
            return (
              <div key={id} className={`panel flex flex-col p-7 ${popular ? "ring-2 ring-accent" : ""}`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  {popular && <span className="chip bg-accent-soft text-accent"><Sparkles className="h-3 w-3" /> Most popular</span>}
                </div>
                <p className="mt-1 text-sm text-muted">{p.blurb}</p>
                <p className="mt-6"><span className="text-5xl font-semibold tracking-tight">${p.price}</span><span className="text-muted"> /month</span></p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-good" />{f}</li>)}</ul>
                <Link href="/signup" className={`${popular ? "btn" : "btn-ghost"} mt-8 h-11 w-full`}>Start free trial</Link>
              </div>
            );
          })}
        </div>
        <section className="mx-auto mt-24 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer items-center justify-between font-medium">{q}<span className="text-faint transition group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
