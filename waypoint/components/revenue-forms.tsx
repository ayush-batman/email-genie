"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import type { FormState } from "@/app/actions.ts";
import { CodeBlock } from "./code-block.tsx";

export function SecretForm({ action, connected, placeholder }: { action: (s: FormState, f: FormData) => Promise<FormState>; connected: boolean; placeholder: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="mt-3 flex flex-wrap gap-2">
      <input name="secret" type="password" required autoComplete="off" className="input min-w-0 flex-1 font-mono" placeholder={connected ? "•••••••• (saved, paste to replace)" : placeholder} aria-label="Signing secret" />
      <button className="btn" disabled={pending}>{pending ? "Saving…" : connected ? "Update" : "Connect"}</button>
      {state?.error && <p role="alert" className="w-full text-sm text-bad">{state.error}</p>}
      {state && !state.error && <p className="w-full text-sm text-good">Saved. Send a test event from your provider to confirm.</p>}
    </form>
  );
}

export function ApiKeyButton({ create, exists, siteId, origin }: { create: () => Promise<{ key?: string; error?: string }>; exists: boolean; siteId: string; origin: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="btn-ghost"
        disabled={pending}
        onClick={async () => {
          if (exists && !confirm("Rotate the key? The current key stops working immediately.")) return;
          setPending(true);
          const r = await create();
          setPending(false);
          if (r.key) setKey(r.key); else setError(r.error ?? "Failed");
        }}
      >
        <KeyRound className="h-4 w-4" /> {exists ? "Rotate API key" : "Create API key"}
      </button>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      {key && (
        <>
          <p className="mt-3 text-sm font-medium text-warn">Copy this key now. It won&apos;t be shown again.</p>
          <CodeBlock code={key} />
          <CodeBlock label="Example" code={`curl -X POST ${origin}/api/v1/revenue \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"site_id":"${siteId}","amount":4900,"currency":"USD","order_id":"ord_123","visitor_id":"<waypoint.getVisitorId()>"}'`} />
        </>
      )}
    </div>
  );
}
