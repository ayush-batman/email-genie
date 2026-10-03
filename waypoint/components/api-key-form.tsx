"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { CodeBlock } from "./code-block.tsx";
import { Tabs } from "./tabs-client.tsx";

export function ApiKeyForm({ action, origin }: { action: (s: { key?: string; error?: string }, f: FormData) => Promise<{ key?: string; error?: string }>; origin: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const key = state.key ?? "wp_live_YOUR_KEY";
  const url = `${origin}/api/mcp`;
  return (
    <div>
      <form action={formAction} className="flex flex-wrap gap-2">
        <input name="name" placeholder="Key name, e.g. Claude Desktop" className="input min-w-56 flex-1" aria-label="Key name" />
        <button className="btn" disabled={pending}><KeyRound className="h-4 w-4" /> {pending ? "Creating…" : "Create key"}</button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-sm text-bad">{state.error}</p>}
      {state.key && (
        <div className="mt-4">
          <p className="text-sm font-medium text-warn">Copy this key now. It won&apos;t be shown again.</p>
          <CodeBlock code={state.key} />
        </div>
      )}
      <div className="mt-6">
        <p className="label">Connect an AI assistant{state.key ? " (your new key is filled in)" : ""}</p>
        <Tabs items={[
          { label: "Claude Code", content: <CodeBlock code={`claude mcp add --transport http waypoint ${url} \\\n  --header "Authorization: Bearer ${key}"`} /> },
          { label: "Claude Desktop", content: <CodeBlock label="claude_desktop_config.json" code={JSON.stringify({ mcpServers: { waypoint: { command: "npx", args: ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${key}`] } } }, null, 2)} /> },
          { label: "Cursor", content: <CodeBlock label=".cursor/mcp.json" code={JSON.stringify({ mcpServers: { waypoint: { url, headers: { Authorization: `Bearer ${key}` } } } }, null, 2)} /> },
          { label: "VS Code", content: <CodeBlock label=".vscode/mcp.json" code={JSON.stringify({ servers: { waypoint: { type: "http", url, headers: { Authorization: `Bearer ${key}` } } } }, null, 2)} /> },
          { label: "REST", content: <CodeBlock code={`curl ${origin}/api/v1/sites \\\n  -H "Authorization: Bearer ${key}"\n\ncurl "${origin}/api/v1/sites/SITE_ID/breakdown?dimension=channel&period=30d" \\\n  -H "Authorization: Bearer ${key}"`} /> },
        ]} />
      </div>
    </div>
  );
}
