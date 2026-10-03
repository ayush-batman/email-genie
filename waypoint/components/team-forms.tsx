"use client";

import { useActionState } from "react";
import { Check, Send } from "lucide-react";
import type { FormState } from "@/app/actions.ts";
import { CodeBlock } from "./code-block.tsx";

export function InviteForm({ action }: { action: (s: FormState & { link?: string }, f: FormData) => Promise<FormState & { link?: string }> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input name="email" type="email" required placeholder="teammate@company.com" className="input min-w-56 flex-1" aria-label="Email" />
        <select name="role" defaultValue="member" className="input w-32" aria-label="Role">
          <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
        </select>
        <button className="btn" disabled={pending}><Send className="h-4 w-4" /> {pending ? "Sending…" : "Send invite"}</button>
      </div>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state.link && (
        <div>
          <p className="flex items-center gap-1.5 text-sm text-good"><Check className="h-4 w-4" /> Invitation sent. You can also share this link:</p>
          <CodeBlock code={state.link} />
        </div>
      )}
    </form>
  );
}

export function RenameForm({ action, name }: { action: (s: FormState, f: FormData) => Promise<FormState>; name: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="name" defaultValue={name} required className="input max-w-xs" aria-label="Team name" />
      <button className="btn-ghost" disabled={pending}>Save</button>
      {state?.error && <span className="text-sm text-bad">{state.error}</span>}
      {state && !state.error && <span className="text-sm text-good">Saved</span>}
    </form>
  );
}
