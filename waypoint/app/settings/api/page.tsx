import { headers } from "next/headers";
import { Bot, KeyRound, Trash2 } from "lucide-react";
import { requireOrg } from "@/lib/auth.ts";
import { sql } from "@/lib/db.ts";
import { ago } from "@/lib/format.ts";
import { TOOLS } from "@/lib/tools.ts";
import { ApiKeyForm } from "@/components/api-key-form.tsx";
import { createApiKey, revokeApiKey } from "../../actions.ts";

export const metadata = { title: "API & MCP" };

export default async function ApiPage() {
  const { org, role } = await requireOrg();
  const manager = role === "owner" || role === "admin";
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const keys = await sql<{ id: string; name: string; prefix: string; last_used_at: Date | null; created_at: Date; revoked_at: Date | null }[]>`
    SELECT id, name, prefix, last_used_at, created_at, revoked_at FROM api_keys WHERE org_id = ${org.id} ORDER BY revoked_at NULLS FIRST, created_at DESC`;

  return (
    <div className="space-y-5">
      <section className="panel p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Bot className="h-5 w-5" /></span>
          <div>
            <h2 className="font-semibold">Ask your analytics</h2>
            <p className="mt-1 text-sm text-muted">Connect Claude, Cursor or any MCP client and ask questions like “which campaigns brought paying customers last month?” The same key works for the REST API.</p>
          </div>
        </div>
        <div className="mt-5">{manager ? <ApiKeyForm action={createApiKey} origin={origin} /> : <p className="text-sm text-muted">Ask an owner or admin to create an API key.</p>}</div>
      </section>

      <section className="panel overflow-hidden">
        <h2 className="border-b border-line p-6 font-semibold">API keys</h2>
        {keys.length === 0 ? <p className="p-6 text-sm text-muted">No keys yet.</p> : (
          <ul className="divide-y divide-line">
            {keys.map((k) => (
              <li key={k.id} className={`flex flex-wrap items-center gap-3 px-6 py-3.5 ${k.revoked_at ? "opacity-50" : ""}`}>
                <KeyRound className="h-4 w-4 text-faint" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-muted"><code>{k.prefix}…</code> · created {ago(k.created_at)} · {k.last_used_at ? `last used ${ago(k.last_used_at)}` : "never used"}</p>
                </div>
                {k.revoked_at ? <span className="chip bg-subtle text-muted">Revoked</span> : manager && (
                  <form action={revokeApiKey.bind(null, k.id)}><button className="btn-ghost h-8 text-xs text-bad"><Trash2 className="h-3.5 w-3.5" /> Revoke</button></form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-6">
        <h2 className="font-semibold">Available tools</h2>
        <p className="mt-1 text-sm text-muted">Every tool is read-only and returns the same numbers as the dashboard. REST endpoints mirror them; see the <a className="text-accent hover:underline" href="/api/v1/openapi.json">OpenAPI spec</a>.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <li key={t.name} className="rounded-xl border border-line p-3.5">
              <p className="font-mono text-sm font-medium">{t.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-faint">GET /api/v1{t.path}</p>
              <p className="mt-1.5 text-xs text-muted">{t.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
