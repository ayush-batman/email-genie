"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions.ts";

export function AuthForm({ mode, action }: { mode: "login" | "signup"; action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const signup = mode === "signup";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Link href="/" className="mb-8 text-lg font-semibold">◆ Waypoint</Link>
      <h1 className="text-2xl font-semibold">{signup ? "Start your 7-day free trial" : "Log in"}</h1>
      <p className="mt-1 text-sm text-muted">{signup ? "No credit card required." : "Welcome back."}</p>
      <form action={formAction} className="mt-6 space-y-4">
        {signup && (
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input className="input" id="name" name="name" autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required minLength={8} autoComplete={signup ? "new-password" : "current-password"} />
        </div>
        {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        <button className="btn w-full justify-center" disabled={pending}>{pending ? "…" : signup ? "Create account" : "Log in"}</button>
      </form>
      <p className="mt-6 text-sm text-muted">
        {signup ? <>Have an account? <Link className="text-accent" href="/login">Log in</Link></> : <>New here? <Link className="text-accent" href="/signup">Start a free trial</Link></>}
      </p>
    </main>
  );
}
