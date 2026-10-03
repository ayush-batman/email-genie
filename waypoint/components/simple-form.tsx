"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions.ts";
import { Logo } from "./logo.tsx";

/** Single-field auth form used by forgot/reset password. */
export function SimpleForm({ action, title, description, field, submit, done }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  title: string; description: string; submit: string; done?: string;
  field: { name: string; label: string; type: string; autoComplete: string };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 inline-block"><Logo /></Link>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-muted">{description}</p>
        {state && !state.error && done ? (
          <p className="mt-6 rounded-lg border border-good/30 bg-good-soft p-3 text-sm">{done}</p>
        ) : (
          <form action={formAction} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor={field.name}>{field.label}</label>
              <input className="input h-10" id={field.name} name={field.name} type={field.type} required minLength={field.type === "password" ? 8 : undefined} autoComplete={field.autoComplete} />
            </div>
            {state?.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{state.error}</p>}
            <button className="btn h-10 w-full" disabled={pending}>{pending ? "One moment…" : submit}</button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted"><Link href="/login" className="text-accent hover:underline">Back to log in</Link></p>
      </div>
    </main>
  );
}
