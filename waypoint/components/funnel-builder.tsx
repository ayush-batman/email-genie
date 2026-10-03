"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { FormState } from "@/app/actions.ts";
import type { Step } from "@/lib/funnels.ts";

const WINDOWS = [[1, "1 hour"], [24, "1 day"], [168, "7 days"], [720, "30 days"], [2160, "90 days"]] as const;

export function FunnelBuilder({ action, pages, events, initial }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  pages: string[];
  events: string[];
  initial?: { name: string; steps: Step[]; window_hours: number };
}) {
  const [steps, setSteps] = useState<Step[]>(initial?.steps ?? [{ kind: "pageview", match: "/" }, { kind: "pageview", match: "/pricing" }, { kind: "event", match: "signup" }]);
  const [state, formAction, pending] = useActionState(action, undefined);
  const set = (i: number, patch: Partial<Step>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => setSteps((s) => { const n = [...s]; [n[i], n[i + d]] = [n[i + d]!, n[i]!]; return n; });

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div>
          <label className="label" htmlFor="fname">Funnel name</label>
          <input id="fname" name="name" className="input" required defaultValue={initial?.name} placeholder="Visitor → signup → purchase" />
        </div>
        <div>
          <label className="label" htmlFor="window">Must convert within</label>
          <select id="window" name="window_hours" className="input" defaultValue={initial?.window_hours ?? 24}>
            {WINDOWS.map(([h, l]) => <option key={h} value={h}>{l}</option>)}
          </select>
        </div>
      </div>

      <div>
        <p className="label">Steps, in order</p>
        <ol className="space-y-2">
          {steps.map((st, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-subtle p-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-fg">{i + 1}</span>
              <select aria-label={`Step ${i + 1} type`} className="input w-32 bg-panel" value={st.kind} onChange={(e) => set(i, { kind: e.target.value as Step["kind"], match: "" })}>
                <option value="pageview">Page view</option>
                <option value="event">Event</option>
              </select>
              <input aria-label={`Step ${i + 1} ${st.kind === "event" ? "event name" : "page path"}`} className="input min-w-40 flex-1 bg-panel" required value={st.match}
                onChange={(e) => set(i, { match: e.target.value })} list={st.kind === "event" ? "funnel-events" : "funnel-pages"}
                placeholder={st.kind === "event" ? "signup" : "/pricing or /blog/*"} />
              <input aria-label={`Step ${i + 1} label`} className="input w-40 bg-panel" value={st.label ?? ""} onChange={(e) => set(i, { label: e.target.value || undefined })} placeholder="Label (optional)" />
              <div className="flex">
                <button type="button" className="rounded-md p-1.5 text-faint hover:bg-panel hover:text-fg disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" className="rounded-md p-1.5 text-faint hover:bg-panel hover:text-fg disabled:opacity-30" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" className="rounded-md p-1.5 text-faint hover:bg-bad-soft hover:text-bad disabled:opacity-30" disabled={steps.length <= 2} onClick={() => setSteps((s) => s.filter((_, j) => j !== i))} aria-label="Remove step"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ol>
        <datalist id="funnel-pages">{pages.map((p) => <option key={p} value={p} />)}</datalist>
        <datalist id="funnel-events">{events.map((p) => <option key={p} value={p} />)}</datalist>
        {steps.length < 10 && (
          <button type="button" className="btn-ghost mt-3" onClick={() => setSteps((s) => [...s, { kind: "pageview", match: "" }])}><Plus className="h-4 w-4" /> Add step</button>
        )}
        <p className="hint">Page paths match exactly; end with * to match a prefix. Visitors must complete steps in this order.</p>
      </div>

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : initial ? "Save funnel" : "Create funnel"}</button>
        {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      </div>
    </form>
  );
}
