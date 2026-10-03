import Link from "next/link";
import { ChevronsUpDown, LogOut, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth.ts";
import { sql } from "@/lib/db.ts";
import { logout } from "@/app/actions.ts";
import { Logo } from "./logo.tsx";
import { SiteNav } from "./site-nav.tsx";

type SiteItem = { id: string; name: string; domain: string };

/** Authenticated app chrome: sidebar with site switcher + nav on desktop, top bar on mobile. */
export async function AppShell({ siteId, children }: { siteId?: string; children: React.ReactNode }) {
  const user = await requireUser();
  const sites = await sql<SiteItem[]>`
    SELECT s.id, s.name, s.domain FROM sites s JOIN memberships m ON m.org_id = s.org_id AND m.user_id = ${user.id} ORDER BY s.created_at`;
  const [org] = await sql<{ name: string; trial_ends_at: Date }[]>`
    SELECT o.name, o.trial_ends_at FROM organizations o JOIN memberships m ON m.org_id = o.id AND m.user_id = ${user.id} ORDER BY o.created_at LIMIT 1`;
  const current = sites.find((s) => s.id === siteId);
  const daysLeft = org ? Math.ceil((org.trial_ends_at.getTime() - Date.now()) / 86_400_000) : 0;

  const switcher = (
    <details className="relative">
      <summary className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-panel px-2.5 py-2 shadow-[var(--shadow)] hover:border-line-strong">
        {current ? <Favicon domain={current.domain} /> : <span className="h-5 w-5 rounded bg-subtle" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{current?.name ?? "All websites"}</span>
          {current && <span className="block truncate text-xs text-muted">{current.domain}</span>}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-faint" />
      </summary>
      <div className="popover absolute inset-x-0 z-30 mt-1.5 p-1.5">
        <Link href="/sites" className="block rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-subtle hover:text-fg">All websites</Link>
        <div className="my-1 h-px bg-line" />
        {sites.map((s) => (
          <Link key={s.id} href={`/sites/${s.id}`} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-subtle" aria-current={s.id === siteId}>
            <Favicon domain={s.domain} />
            <span className="truncate">{s.name}</span>
          </Link>
        ))}
        <Link href="/sites/new" className="mt-1 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-accent hover:bg-subtle"><Plus className="h-4 w-4" /> Add website</Link>
      </div>
    </details>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-5 border-r border-line bg-subtle px-3 py-4 lg:flex">
        <Link href="/sites" className="px-2"><Logo /></Link>
        {switcher}
        {current && <SiteNav siteId={current.id} />}
        <div className="mt-auto space-y-3">
          {daysLeft > 0 && (
            <div className="rounded-lg border border-line bg-panel p-3 text-xs">
              <p className="font-medium">Free trial · {daysLeft} day{daysLeft === 1 ? "" : "s"} left</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(8, (daysLeft / 7) * 100)}%` }} /></div>
            </div>
          )}
          <div className="flex items-center gap-2 px-1">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.name || user.email.split("@")[0]}</span>
              <span className="block truncate text-xs text-muted">{org?.name}</span>
            </span>
            <form action={logout}><button className="rounded-md p-1.5 text-faint hover:bg-panel hover:text-fg" aria-label="Log out" title="Log out"><LogOut className="h-4 w-4" /></button></form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-subtle/90 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/sites"><Logo /></Link>
          <div className="ml-auto w-48">{switcher}</div>
        </div>
        {current && <div className="overflow-x-auto px-2 pb-2"><SiteNav siteId={current.id} horizontal /></div>}
      </header>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Favicon({ domain }: { domain: string }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-accent-soft text-[10px] font-semibold uppercase text-accent" aria-hidden>
      {domain.slice(0, 1)}
    </span>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="mr-auto">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}
