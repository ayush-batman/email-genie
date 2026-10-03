"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/app/actions.ts";

export function GoalForm({ action, suggestions }: { action: (s: FormState, f: FormData) => Promise<FormState>; suggestions: string[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"event" | "pageview">("event");
  const [state, formAction, pending] = useActionState(async (s: FormState, f: FormData) => {
    const r = await action(s, f);
    if (!r?.error) ref.current?.reset();
    return r;
  }, undefined);
  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <div className="tabs w-full">
        {(["event", "pageview"] as const).map((k) => (
          <label key={k} className="tab flex-1 cursor-pointer text-center has-[:checked]:bg-panel has-[:checked]:font-medium has-[:checked]:text-fg has-[:checked]:shadow-[var(--shadow)]">
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
            {k === "event" ? "Custom event" : "Page visit"}
          </label>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="match">{kind === "event" ? "Event name" : "Page path"}</label>
        <input className="input" id="match" name="match" required list={kind === "event" ? "event-suggestions" : undefined} placeholder={kind === "event" ? "signup" : "/thank-you or /blog/*"} />
        <datalist id="event-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        <p className="hint">{kind === "event" ? "Matches waypoint.track(name) calls." : "Exact path, or end with * to match a prefix."}</p>
      </div>
      <div>
        <label className="label" htmlFor="goal-name">Display name</label>
        <input className="input" id="goal-name" name="name" required placeholder={kind === "event" ? "Signed up" : "Reached thank-you page"} />
      </div>
      <button className="btn w-full" disabled={pending}>{pending ? "Adding…" : "Add goal"}</button>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}
