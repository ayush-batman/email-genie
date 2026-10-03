"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions.ts";

type Values = { name: string; domain: string; timezone: string; mode: "private" | "product" };

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
        </div>
      </div>
      <div>
        <label className="label" htmlFor="timezone">Reporting timezone</label>
        <select className="input" id="timezone" name="timezone" defaultValue={tz}>
          {["UTC", ...Intl.supportedValuesOf("timeZone")].map((z) => <option key={z}>{z}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="label">Data collection mode</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["private", "Private", "Cookieless. No storage on the visitor's device and no cross-day identity. Usually no consent banner needed."],
            ["product", "Product", "First-party visitor ID in localStorage. Recognises returning visitors, enables identify() and revenue attribution. May require consent (GDPR/ePrivacy)."],
          ] as const).map(([value, title, desc]) => (
            <label key={value} className="panel flex cursor-pointer gap-3 p-3 has-[:checked]:border-accent">
              <input type="radio" name="mode" value={value} defaultChecked={(values?.mode ?? "private") === value} className="mt-1" />
              <span><span className="font-medium">{title}</span><span className="mt-1 block text-xs text-muted">{desc}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state && !state.error && <p className="text-sm text-good">Saved.</p>}
      <button className="btn" disabled={pending}>{pending ? "Saving…" : submit}</button>
    </form>
  );
}
