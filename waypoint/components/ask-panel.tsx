"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, Loader2, Sparkles, X } from "lucide-react";

type Turn = { q: string; a?: string; error?: string; tools?: string[] };
const SUGGESTIONS = ["Which channels brought paying customers last month?", "Why did traffic change this week?", "Where do visitors drop off before signing up?", "What are my top landing pages by revenue?"];

/** Minimal markdown: paragraphs, **bold**, and - bullets. */
function Md({ text }: { text: string }) {
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p));
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        return lines.every((l) => /^\s*[-*•] /.test(l)) ? (
          <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{bold(l.replace(/^\s*[-*•] /, ""))}</li>)}</ul>
        ) : <p key={i}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{bold(l.replace(/^#+\s*/, ""))}</span>)}</p>;
      })}
    </div>
  );
}

export function AskPanel({ siteId }: { siteId: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [turns]);

  async function send(question: string) {
    if (!question.trim() || busy) return;
    setQ(""); setBusy(true);
    const history = turns.filter((t) => t.a).map((t) => ({ q: t.q, a: t.a! }));
    setTurns((t) => [...t, { q: question }]);
    try {
      const res = await fetch(`/api/sites/${siteId}/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, history }) });
      const data = await res.json();
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a: data.answer, error: data.error, tools: data.tools } : x)));
    } catch {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: "Network error" } : x)));
    }
    setBusy(false);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn fixed right-5 bottom-5 z-30 h-11 rounded-full px-5 shadow-[var(--shadow-lg)]" aria-label="Ask your analytics">
        <Sparkles className="h-4 w-4" /> Ask
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-[1px]" onClick={() => setOpen(false)}>
          <aside role="dialog" aria-label="Ask your analytics" className="flex h-full w-full max-w-md flex-col border-l border-line bg-panel shadow-[var(--shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center gap-2 border-b border-line px-5 py-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent"><Bot className="h-4 w-4" /></span>
              <div className="flex-1"><p className="font-semibold">Ask your analytics</p><p className="text-xs text-muted">Answers use live data from this site</p></div>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-faint hover:bg-subtle hover:text-fg" aria-label="Close"><X className="h-4 w-4" /></button>
            </header>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
              {turns.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted">Try asking</p>
                  {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="block w-full rounded-xl border border-line px-3 py-2.5 text-left hover:border-accent hover:bg-accent-soft/40">{s}</button>)}
                </div>
              )}
              {turns.map((t, i) => (
                <div key={i} className="space-y-2">
                  <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-accent-fg">{t.q}</p>
                  {t.a ? (
                    <div className="max-w-[95%] rounded-2xl rounded-bl-md bg-subtle px-3.5 py-2.5 leading-relaxed">
                      <Md text={t.a} />
                      {t.tools && t.tools.length > 0 && <p className="mt-2 text-[11px] text-faint">Looked up: {[...new Set(t.tools)].join(", ").replaceAll("_", " ")}</p>}
                    </div>
                  ) : t.error ? (
                    <p className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-bad">{t.error}</p>
                  ) : (
                    <p className="flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Looking at your data…</p>
                  )}
                </div>
              ))}
              <div ref={end} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="border-t border-line p-4">
              <div className="flex items-end gap-2 rounded-xl border border-line bg-panel p-1.5 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
                <textarea value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(q); } }}
                  rows={1} placeholder="Ask about traffic, sources, revenue…" className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 outline-none focus-visible:outline-none" aria-label="Your question" />
                <button className="btn h-8 w-8 rounded-lg p-0" disabled={busy || !q.trim()} aria-label="Send"><ArrowUp className="h-4 w-4" /></button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
