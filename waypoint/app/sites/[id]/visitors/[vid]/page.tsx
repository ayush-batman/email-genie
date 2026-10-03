import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDollarSign, Download, ExternalLink, FileDown, MousePointerClick, ScrollText, Trash2, Zap } from "lucide-react";
import { canEdit, requireSite } from "@/lib/auth.ts";
import { visitorProfile, type ProfileEvent } from "@/lib/visitors.ts";
import { visitorName } from "@/lib/names.ts";
import { ago, chDate, countryName, duration, flag, money } from "@/lib/format.ts";
import { VisitorAvatar } from "@/components/avatar.tsx";
import { deleteVisitorAction } from "../../../../actions.ts";

export const metadata = { title: "Visitor" };

function EventIcon({ e }: { e: ProfileEvent }) {
  const cls = "h-3.5 w-3.5";
  const [Icon, tone] =
    e.type === "revenue" || e.revenue_minor ? [CircleDollarSign, "bg-good-soft text-good"]
    : e.type === "pageview" ? [ScrollText, "bg-subtle text-muted"]
    : e.name === "outbound_click" ? [ExternalLink, "bg-subtle text-muted"]
    : e.name === "file_download" ? [FileDown, "bg-subtle text-muted"]
    : e.name.includes("click") ? [MousePointerClick, "bg-accent-soft text-accent"]
    : [Zap, "bg-accent-soft text-accent"];
  return <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-4 ring-panel ${tone}`}><Icon className={cls} /></span>;
}

export default async function VisitorPage({ params }: { params: Promise<{ id: string; vid: string }> }) {
  const { id, vid: raw } = await params;
  const { site, role } = await requireSite(id);
  const vid = decodeURIComponent(raw);
  const p = await visitorProfile(site.id, vid);
  if (!p) notFound();
  const title = p.userId || visitorName(vid);
  const visits = p.sessions.filter((s) => !s.id.startsWith("pay:")).length;
  const tz = site.timezone;
  const time = (s: string) => chDate(s).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const day = (s: string) => chDate(s).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: tz });

  const facts: [string, React.ReactNode][] = [
    ["First seen", ago(chDate(p.first.time))],
    ["Last seen", ago(chDate(p.last.time))],
    ["Visits", visits],
    ["Pageviews", p.pageviews],
    ["Revenue", p.revenue ? money(p.revenue, site.currency) : "—"],
  ];
  const attrs: [string, React.ReactNode][] = [
    ["First touch", <>{p.first.referrer_domain || p.first.channel}{p.first.utm_campaign && <span className="text-muted"> · {p.first.utm_campaign}</span>}</>],
    ["Last touch", <>{p.lastTouch.referrer_domain || p.lastTouch.channel}{p.lastTouch.utm_campaign && <span className="text-muted"> · {p.lastTouch.utm_campaign}</span>}</>],
    ["Landing page", p.first.url_path],
    ["Location", p.last.country ? <>{flag(p.last.country)} {[p.last.city, countryName(p.last.country)].filter(Boolean).join(", ")}</> : "Unknown"],
    ["Device", <span className="capitalize">{p.last.device} · {p.last.browser} · {p.last.os}</span>],
    ["Visitor IDs", <span className="font-mono text-xs break-all">{p.visitorIds.join(", ")}</span>],
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <Link href={`/sites/${site.id}/visitors`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" /> Visitors</Link>

      <div className="mt-4 grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <section className="panel p-5">
            <div className="flex items-center gap-3">
              <VisitorAvatar id={vid} size={48} />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
                <p className="text-xs text-muted">{p.userId ? `Identified · ${visitorName(vid)}` : "Anonymous visitor"}</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              {facts.map(([k, v]) => (
                <div key={k} className="rounded-lg bg-subtle px-3 py-2.5">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{k}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <dl className="mt-5 space-y-3 text-sm">
              {attrs.map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5">{v}</dd></div>
              ))}
            </dl>
          </section>

          <section className="panel p-5 text-sm">
            <h2 className="font-semibold">Data rights</h2>
            <p className="mt-1 text-xs text-muted">Export or permanently erase everything stored about this person, including visitors linked by user ID.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`/api/sites/${site.id}/visitors/${encodeURIComponent(vid)}`} className="btn-ghost"><Download className="h-4 w-4" /> Export JSON</a>
              {canEdit(role) && (
                <details className="relative">
                  <summary className="btn-ghost cursor-pointer text-bad"><Trash2 className="h-4 w-4" /> Delete</summary>
                  <form action={deleteVisitorAction.bind(null, site.id, vid)} className="popover absolute left-0 z-20 mt-1.5 w-64 p-3">
                    <p className="text-xs">This deletes all of this visitor&apos;s events. It can&apos;t be undone.</p>
                    <button className="btn btn-danger mt-3 w-full">Delete permanently</button>
                  </form>
                </details>
              )}
            </div>
          </section>
        </aside>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted">Activity · {visits} visit{visits === 1 ? "" : "s"}</h2>
          {p.sessions.map((s) => {
            if (s.id.startsWith("pay:")) {
              const e = s.events[0]!;
              return (
                <article key={s.id} className="panel flex items-center gap-3 px-5 py-3.5">
                  <EventIcon e={e} />
                  <span className="text-sm"><span className={`font-semibold ${e.revenue_minor < 0 ? "text-bad" : "text-good"}`}>{money(e.revenue_minor, e.revenue_currency || site.currency)}</span> <span className="text-muted">{e.name === "refund" ? "refund" : e.name === "renewal" ? "subscription renewal" : "payment"}{e.props.provider && ` via ${e.props.provider}`}</span></span>
                  <time className="ml-auto text-xs text-faint">{day(e.time)} · {time(e.time)}</time>
                </article>
              );
            }
            const events = s.events.filter((e) => e.type !== "ping");
            const engaged = s.events.reduce((a, e) => a + e.engaged_ms, 0) / 1000;
            const head = events[0] ?? s.events[0]!;
            return (
              <article key={s.id} className="panel overflow-hidden">
                <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-subtle px-5 py-3 text-sm">
                  <span className="font-medium">{day(s.start)}</span>
                  <span className="text-muted">{time(s.start)}</span>
                  <span className="chip bg-panel ring-1 ring-line">{head.referrer_domain || head.channel}</span>
                  <span className="ml-auto text-xs text-muted">{events.filter((e) => e.type === "pageview").length} pages · {duration(engaged)} engaged</span>
                </header>
                <ol className="relative px-5 py-4">
                  <span className="absolute top-6 bottom-6 left-[31px] w-px bg-line" aria-hidden />
                  {events.map((e, i) => (
                    <li key={i} className="relative flex items-start gap-3 py-1.5">
                      <EventIcon e={e} />
                      <div className="min-w-0 flex-1 text-sm">
                        {e.type === "pageview" ? (
                          <p><span className="text-muted">Viewed</span> <span className="font-medium">{e.url_path}</span>{e.title && <span className="ml-1.5 text-xs text-faint">{e.title}</span>}</p>
                        ) : e.type === "revenue" ? (
                          <p><span className="font-medium text-good">{money(e.revenue_minor, e.revenue_currency || site.currency)}</span> <span className="text-muted">{e.name === "refund" ? "refunded" : e.name === "renewal" ? "renewal" : "payment"}</span>{e.props.provider && <span className="ml-1.5 text-xs text-faint">via {e.props.provider}</span>}</p>
                        ) : (
                          <p>
                            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">{e.name}</span>
                            {Object.entries(e.props).map(([k, v]) => <span key={k} className="ml-1.5 text-xs text-muted">{k}=<span className="text-fg">{v}</span></span>)}
                            {e.revenue_minor !== 0 && <span className="ml-1.5 text-xs font-medium text-good">{money(e.revenue_minor, e.revenue_currency)}</span>}
                          </p>
                        )}
                      </div>
                      <time className="shrink-0 text-xs tabular-nums text-faint">{time(e.time)}</time>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
