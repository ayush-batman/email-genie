"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

type P = { id: string; name: string; files: string; help: string };

export function ImportForm({ siteId, providers }: { siteId: string; providers: P[] }) {
  const [provider, setProvider] = useState(providers[0]!.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const p = providers.find((x) => x.id === provider)!;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        const res = await fetch(`/api/sites/${siteId}/imports`, { method: "POST", body: new FormData(e.currentTarget) });
        setBusy(false);
        if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Upload failed");
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        {providers.map((x) => (
          <label key={x.id} className="cursor-pointer rounded-xl border border-line p-3 text-sm transition hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40 has-[:checked]:ring-1 has-[:checked]:ring-accent">
            <input type="radio" name="provider" value={x.id} checked={provider === x.id} onChange={() => setProvider(x.id)} className="sr-only" />
            <span className="font-medium">{x.name}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">{p.help} <br />Upload: <b className="text-fg">{p.files}</b>.</p>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-subtle px-4 py-6 text-center text-sm text-muted hover:border-accent">
        <Upload className="h-5 w-5" />
        <span>Choose files (up to 100 MB total)</span>
        <input type="file" name="files" multiple required accept=".csv,.json,.ndjson,.txt" className="text-xs" aria-label="Export files" />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="only_before" defaultChecked /> Only import data from before Waypoint started tracking (avoids double counting)</label>
      <div className="flex items-center gap-3">
        <button className="btn" disabled={busy}>{busy ? "Uploading…" : "Start import"}</button>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      </div>
    </form>
  );
}
