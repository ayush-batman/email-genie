import Link from "next/link";
import Image from "next/image";
import { Activity, ArrowRight, BarChart3, Bot, CircleDollarSign, Download, EyeOff, Filter, History, Share2, Target, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-header.tsx";

const FEATURES = [
  { icon: Activity, title: "See live activity", body: "Who's online right now and a real-time stream of every pageview and event.", live: true },
  { icon: BarChart3, title: "Know every source", body: "Channels, referrers, UTM campaigns and AI assistants like ChatGPT and Perplexity, classified for you.", live: true },
  { icon: CircleDollarSign, title: "Connect revenue and results", body: "Stripe, Lemon Squeezy, Polar and Paddle payments attributed by first or last touch.", live: true },
  { icon: Users, title: "Understand each visitor", body: "Every visit, page and event in one timeline, linked to your users with identify().", live: true },
  { icon: Target, title: "Track what matters", body: "Custom events with properties and goals with conversion rates, from one line of code.", live: true },
  { icon: EyeOff, title: "Analytics without cookies", body: "Private mode stores nothing on the device. Product mode remembers returning visitors when you need it.", live: true },
  { icon: Filter, title: "Find where people leave", body: "Funnels with step-by-step drop-off and time to convert.", live: true },
  { icon: Bot, title: "Ask your analytics", body: "An MCP server so Claude, Cursor and other AI tools can answer questions about your traffic.", live: true },
  { icon: History, title: "Keep your history", body: "Import from Umami, Databuddy and Vercel Analytics.", live: true },
];

export default function Landing() {
  return (
    <div className="overflow-x-hidden">
      <SiteHeader />

      <main>
        <section className="relative">
          <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-[420px] max-w-4xl rounded-full bg-accent opacity-[0.12] blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-14 text-center sm:px-8 sm:pt-28">
            <span className="chip bg-accent-soft text-accent">Privacy-friendly · Revenue-aware</span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">See what actually turns visitors into revenue.</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted text-balance">Waypoint shows founders where visitors come from, where they drop off, and which sources pay. One script tag, no cookies required.</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="btn h-11 px-6 text-base">Start 7-day free trial <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/share/demo" className="btn-ghost h-11 px-6 text-base">Explore the demo</Link>
            </div>
            <p className="mt-4 text-xs text-muted">No credit card · Set up in 60 seconds</p>
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
            <div className="overflow-hidden rounded-2xl border border-line bg-panel p-1.5 shadow-[var(--shadow-lg)]">
              <Image src="/hero.png" alt="Waypoint dashboard showing visitors, sources and revenue" width={2400} height={1500} className="rounded-xl" priority />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">Everything a small team needs. Nothing it doesn&apos;t.</h2>
            <p className="mt-3 text-muted">Simple enough to read in ten seconds, deep enough to explain why last month was your best.</p>
          </div>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body, live }) => (
              <li key={title} className="bg-panel p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent"><Icon className="h-[18px] w-[18px]" /></span>
                  <h3 className="font-semibold">{title}</h3>
                  {!live && <span className="chip ml-auto bg-subtle text-muted">Soon</span>}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-24 sm:px-8 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Install in one line. Track anything in one more.</h2>
            <p className="mt-3 text-muted">A tracker under 3 KB that handles single-page apps, outbound links and downloads automatically. Add custom events with a function call or an HTML attribute.</p>
            <ul className="mt-6 space-y-2 text-sm">
              {[[Share2, "Public dashboards for your investors or community"], [Download, "CSV export for every table"], [EyeOff, "Visitor IPs are never stored"]].map(([Icon, t]) => {
                const I = Icon as typeof Share2;
                return <li key={t as string} className="flex items-center gap-2"><I className="h-4 w-4 text-accent" /> {t as string}</li>;
              })}
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-[#16161a] text-[13px] leading-relaxed text-[#e6e6ea] shadow-[var(--shadow-lg)]">
            <div className="flex gap-1.5 border-b border-white/10 px-4 py-3"><span className="h-3 w-3 rounded-full bg-white/15" /><span className="h-3 w-3 rounded-full bg-white/15" /><span className="h-3 w-3 rounded-full bg-white/15" /></div>
            <pre className="overflow-x-auto p-5"><code><span className="text-white/40">{"<!-- 1. Add to <head> -->"}</span>{"\n"}<span className="text-[#a5b4fc]">{"<script"}</span> defer src=<span className="text-[#86efac]">&quot;/w.js&quot;</span> data-site=<span className="text-[#86efac]">&quot;abc123&quot;</span><span className="text-[#a5b4fc]">{"></script>"}</span>{"\n\n"}<span className="text-white/40">{"// 2. Track what matters"}</span>{"\n"}waypoint.<span className="text-[#fcd34d]">track</span>(<span className="text-[#86efac]">&quot;signup&quot;</span>, {"{ plan: "}<span className="text-[#86efac]">&quot;pro&quot;</span>{" }"});{"\n\n"}<span className="text-white/40">{"// 3. Pass the visitor to checkout"}</span>{"\n"}metadata: {"{ waypoint_visitor_id: waypoint."}<span className="text-[#fcd34d]">getVisitorId</span>{"() }"}</code></pre>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-accent px-6 py-14 text-center text-accent-fg sm:px-12">
            <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <h2 className="relative text-3xl font-semibold tracking-tight">Know your numbers by tonight.</h2>
            <p className="relative mx-auto mt-3 max-w-lg opacity-85">Seven days free. Connect your first website in under a minute.</p>
            <Link href="/signup" className="relative mt-8 inline-flex h-11 items-center gap-2 rounded-[9px] bg-white px-6 font-medium text-[#18181b] hover:bg-white/90">Start free trial <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
