"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Pause, Play, Smartphone, Tablet } from "lucide-react";
import type { FeedItem } from "@/lib/stats.ts";
import { visitorName } from "@/lib/names.ts";
import { chDate, flag } from "@/lib/format.ts";

const DEVICE = { desktop: Monitor, mobile: Smartphone, tablet: Tablet } as Record<string, typeof Monitor>;

export function LiveFeed({ siteId }: { siteId: string }) {
  const [online, setOnline] = useState<number | null>(null);
  const [events, setEvents] = useState<(FeedItem & { fresh?: boolean })[]>([]);
  const [paused, setPaused] = useState(false);
  const [onlyEvents, setOnlyEvents] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (paused) return;
    let first = true;
    const es = new EventSource(`/api/sites/${siteId}/live`);
    es.onmessage = (m) => {
      const data = JSON.parse(m.data) as { online: number; events: FeedItem[] };
      setOnline(data.online);
      if (data.events.length) setEvents((prev) => [...data.events.map((e) => ({ ...e, fresh: !first })), ...prev.map((e) => ({ ...e, fresh: false }))].slice(0, 200));
      first = false;
    };
    const t = setInterval(() => router.refresh(), 15_000); // refresh the server-rendered panels around the feed
    return () => { es.close(); clearInterval(t); };
  }, [siteId, paused, router]);

  const shown = onlyEvents ? events.filter((e) => e.type === "event") : events;
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
        <span className="relative flex h-3 w-3">
          {!paused && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />}
          <span className={`relative inline-flex h-3 w-3 rounded-full ${paused ? "bg-faint" : "bg-good"}`} />
        </span>
        <span className="text-3xl font-semibold tracking-tight tabular-nums" aria-live="polite">{online ?? "–"}</span>
        <span className="mr-auto text-sm text-muted">visitors online now</span>
        <div className="tabs">
          <button className="tab" aria-current={!onlyEvents} onClick={() => setOnlyEvents(false)}>All activity</button>
          <button className="tab" aria-current={onlyEvents} onClick={() => setOnlyEvents(true)}>Events only</button>
        </div>
        <button className="btn-ghost" onClick={() => setPaused((p) => !p)}>{paused ? <><Play className="h-4 w-4" /> Resume</> : <><Pause className="h-4 w-4" /> Pause</>}</button>
      </div>
      {shown.length === 0 ? (
        <div className="grid place-items-center px-6 py-16 text-center">
          <span className="relative flex h-10 w-10 items-center justify-center"><span className="absolute h-full w-full animate-ping rounded-full bg-accent-soft" /><span className="h-3 w-3 rounded-full bg-accent" /></span>
          <p className="mt-4 font-medium">Waiting for activity…</p>
          <p className="mt-1 text-sm text-muted">New pageviews and events appear here the moment they happen.</p>
        </div>
      ) : (
        <ul className="max-h-[560px] divide-y divide-line overflow-y-auto text-sm">
          {shown.map((e, i) => {
            const Icon = DEVICE[e.device] ?? Monitor;
            return (
              <li key={`${e.time}-${e.visitor_id}-${i}`} className={`flex items-center gap-3 px-5 py-2.5 transition-colors ${e.fresh ? "animate-[pulse_1s_ease-out_1] bg-accent-soft/40" : ""}`}>
                <time className="w-16 shrink-0 text-xs tabular-nums text-faint">{chDate(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                <span className="shrink-0" title={e.country || "Unknown"}>{flag(e.country)}</span>
                <Icon className="h-4 w-4 shrink-0 text-faint" aria-label={e.device} />
                <Link href={`/sites/${siteId}/visitors/${encodeURIComponent(e.visitor_id)}`} className="w-28 shrink-0 truncate font-medium hover:underline sm:w-36">{visitorName(e.visitor_id)}</Link>
                {e.type === "event" ? (
                  <span className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">{e.name}</span>
                ) : e.type === "revenue" ? (
                  <span className="shrink-0 rounded-md bg-good-soft px-1.5 py-0.5 text-xs font-medium text-good">{e.name}</span>
                ) : (
                  <span className="shrink-0 text-xs text-muted">viewed</span>
                )}
                <span className="min-w-0 flex-1 truncate">{e.url_path}</span>
                <span className="hidden shrink-0 truncate text-xs text-muted sm:block sm:max-w-36">{e.referrer_domain || e.channel}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
