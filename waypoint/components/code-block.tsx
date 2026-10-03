"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative mt-3 overflow-hidden rounded-xl border border-line bg-[#16161a] text-[#e6e6ea]">
      {label && <div className="border-b border-white/10 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-white/50">{label}</div>}
      <pre className="overflow-x-auto p-4 pr-24 text-[12.5px] leading-relaxed"><code>{code}</code></pre>
      <button
        type="button"
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/20"
        aria-label="Copy to clipboard"
      >
        {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
      </button>
    </div>
  );
}
