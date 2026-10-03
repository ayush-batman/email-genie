"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BarChart3, CircleDollarSign, ShieldCheck } from "lucide-react";
import type { FormState } from "@/app/actions.ts";
import { Logo } from "./logo.tsx";

const POINTS = [
  { icon: BarChart3, title: "Every source, every page", body: "Channels, campaigns, AI assistants and referrers, classified automatically." },
  { icon: CircleDollarSign, title: "Revenue, attributed", body: "Stripe, Lemon Squeezy, Polar and Paddle payments matched to the visit that drove them." },
  { icon: ShieldCheck, title: "Private by default", body: "No cookies, no personal data stored. GDPR-friendly out of the box." },
];

export function AuthForm({ mode, action, next = "", email = "", note }: { mode: "login" | "signup"; action: (s: FormState, f: FormData) => Promise<FormState>; next?: string; email?: string; note?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const signup = mode === "signup";
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/"><Logo /></Link>
        <div className="m-auto w-full max-w-sm py-12">
          <h1 className="text-2xl font-semibold tracking-tight">{signup ? (next ? "Create your account" : "Start your 7-day free trial") : "Welcome back"}</h1>
          <p className="mt-1.5 text-sm text-muted">{signup ? "No credit card required. Set up in under a minute." : "Log in to see what your visitors are up to."}</p>
          {note && <p className="mt-6 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm">{note}</p>}
          <form action={formAction} className="mt-8 space-y-4">
            <input type="hidden" name="next" value={next} />
            {signup && (
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input className="input h-10" id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Work email</label>
              <input className="input h-10" id="email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" defaultValue={email} />
            </div>
            <div>
              <div className="flex items-baseline justify-between"><label className="label" htmlFor="password">Password</label>{!signup && <Link href="/forgot-password" className="text-xs text-accent hover:underline">Forgot password?</Link>}</div>
              <input className="input h-10" id="password" name="password" type="password" required minLength={8} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 8 characters" : ""} />
            </div>
            {state?.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{state.error}</p>}
            <button className="btn h-10 w-full" disabled={pending}>{pending ? "One moment…" : signup ? "Create account" : "Log in"}</button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            {signup ? <>Already have an account? <Link className="font-medium text-accent hover:underline" href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Log in</Link></> : <>New to Waypoint? <Link className="font-medium text-accent hover:underline" href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>Create an account</Link></>}
          </p>
        </div>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line bg-subtle lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-accent opacity-15 blur-3xl" aria-hidden />
        <p className="text-sm font-medium text-accent">Analytics that answer one question</p>
        <h2 className="mt-2 max-w-md text-3xl font-semibold tracking-tight">Where do visitors come from, where do they leave, and what turns into revenue?</h2>
        <ul className="mt-10 max-w-md space-y-6">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-panel text-accent shadow-[var(--shadow)] ring-1 ring-line"><Icon className="h-5 w-5" /></span>
              <span><span className="font-medium">{title}</span><span className="mt-0.5 block text-sm text-muted">{body}</span></span>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
