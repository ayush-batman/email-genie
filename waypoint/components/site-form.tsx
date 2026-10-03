"use client";

import { useActionState } from "react";
import { Check, EyeOff, UserRound } from "lucide-react";
import type { FormState } from "@/app/actions.ts";

type Values = { name: string; domain: string; timezone: string; currency: string; mode: "private" | "product" };
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "BRL", "SGD", "CHF", "SEK"];

export function SiteForm({ action, values, submit }: { action: (s: FormState, f: FormData) => Promise<FormState>; values?: Values; submit: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const tz = values?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input className="input" id="name" name="name" required defaultValue={values?.name} placeholder="My SaaS" />
        </div>
        <div>
          <label className="label" htmlFor="domain">Domain</label>
          <input className="input" id="domain" name="domain" required defaultValue={values?.domain} placeholder="example.com" />
          <p className="hint">Subdomains are included automatically.</p>
        </div>
        <div>
          <label className="label" htmlFor="timezone">Reporting timezone</label>
          <select className="input" id="timezone" name="timezone" defaultValue={tz}>
            {["UTC", ...Intl.supportedValuesOf("timeZone")].map((z) => <option key={z}>{z}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="currency">Revenue currency</label>
          <select className="input" id="currency" name="currency" defaultValue={values?.currency ?? "USD"}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="label">Data collection</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["private", "Private", EyeOff, "No cookies or device storage. Visitors can't be linked across days. Usually no consent banner needed."],
            ["product", "Product", UserRound, "Remembers returning visitors with a first-party ID. Unlocks visitor profiles, identify() and revenue attribution. May need consent."],
          ] as const).map(([value, title, Icon, desc]) => (
            <label key={value} className="group relative flex cursor-pointer gap-3 rounded-xl border border-line bg-panel p-4 transition hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40 has-[:checked]:ring-1 has-[:checked]:ring-accent">
              <input type="radio" name="mode" value={value} defaultChecked={(values?.mode ?? "private") === value} className="peer sr-only" />
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-subtle text-muted group-has-[:checked]:bg-accent group-has-[:checked]:text-accent-fg"><Icon className="h-4 w-4" /></span>
              <span><span className="text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-relaxed text-muted">{desc}</span></span>
              <Check className="absolute top-3 right-3 hidden h-4 w-4 text-accent peer-checked:block" />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : submit}</button>
        {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        {state && !state.error && <p className="flex items-center gap-1 text-sm text-good"><Check className="h-4 w-4" /> Saved</p>}
      </div>
    </form>
  );
}
