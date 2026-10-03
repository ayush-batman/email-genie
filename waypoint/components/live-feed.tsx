"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedItem } from "@/lib/stats.ts";
import { visitorName } from "@/lib/names.ts";

const flag = (cc: string) => (cc.length === 2 ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐");
const icon = { desktop: "🖥", mobile: "📱", tablet: "📱" } as Record<string, string>;

export function LiveFeed({ siteId }: { siteId: string }) {
  const [online, setOnline] = useState<number | null>(null);
  const [events, setEvents] = useState<FeedItem[]>([]);
  const [paused, setPaused] = useState(false);
  const [onlyEvents, setOnlyEvents] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (paused) return;
    const es = new EventSource(`/api/sites/${siteId}/live`);
    es.onmessage = (m) => {
      const data = JSON.parse(m.data) as { online: number; events: FeedItem[] };
      setOnline(data.online);
      if (data.events.length) setEvents((prev) => [...data.events, ...prev].slice(0, 200));
    };
    // Refresh the server-rendered panels around the feed.
    const t = setInterval(() => router.refresh(), 15_000);
    return () => {
      es.close();
      clearInterval(t);
    };
  }, [siteId, paused, router]);

  const shown = onlyEvents ? events.filter((e) => e.type === "event") : events;
  return (
    <section className="panel p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="relative flex h-3 w-3">
          {!paused && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />}
          <span className="relative inline-flex h-3 w-3 rounded-full bg-good" />
        </span>
        <span className="text-2xl font-semibold tabular-nums" aria-live="polite">{online ?? "–"}</span>
        <span className="mr-auto text-sm text-muted">visitors online now</span>
        <label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" checked={onlyEvents} onChange={(e) => setOnlyEvents(e.target.checked)} /> Custom events only</label>
        <button className="btn-ghost" onClick={() => setPaused((p) => !p)}>{paused ? "Resume" : "Pause"}</button>
      </div>
      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Waiting for activity… new pageviews and events will appear here in real time.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {shown.map((e, i) => (
            <li key={`${e.time}-${e.visitor_id}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <time className="w-20 text-xs tabular-nums text-muted">{new Date(e.time.replace(" ", "T") + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
              <span title={e.country}>{flag(e.country)}</span>
              <span title={e.device}>{icon[e.device] ?? "🖥"}</span>
              <span className="w-32 truncate font-medium">{visitorName(e.visitor_id)}</span>
              {e.type === "event" ? (
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium">{e.name}</span>
              ) : (
                <span className="text-xs text-muted">viewed</span>
              )}
              <span className="min-w-0 flex-1 truncate">{e.url_path}</span>
              <span className="text-xs text-muted">{e.referrer_domain || e.channel}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
