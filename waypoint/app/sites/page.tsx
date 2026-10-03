import Link from "next/link";
import { requireUser } from "@/lib/auth.ts";
import { chQuery, sql, type Site } from "@/lib/db.ts";
import { AppHeader } from "@/components/app-header.tsx";

export const metadata = { title: "Sites" };

export default async function SitesPage() {
  const user = await requireUser();
  const sites = await sql<(Site & { org_name: string; trial_ends_at: Date })[]>`
    SELECT s.*, o.name AS org_name, o.trial_ends_at FROM sites s
    JOIN memberships m ON m.org_id = s.org_id AND m.user_id = ${user.id}
    JOIN organizations o ON o.id = s.org_id ORDER BY s.created_at`;
  const stats = sites.length
    ? await chQuery<{ site_id: string; visitors: string; online: string }>(
        `SELECT site_id, uniqExact(visitor_id) AS visitors, uniqExactIf(visitor_id, ts > now() - INTERVAL 5 MINUTE) AS online
         FROM events WHERE site_id IN {ids:Array(UUID)} AND ts > now() - INTERVAL 1 DAY GROUP BY site_id`,
        { ids: sites.map((s) => s.id) },
      )
    : [];
  const byId = new Map(stats.map((s) => [s.site_id, s]));

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Websites</h1>
          <Link href="/sites/new" className="btn">+ Add website</Link>
        </div>
        {sites.length === 0 ? (
          <div className="panel p-10 text-center">
            <p className="text-lg font-medium">Connect your first website</p>
            <p className="mt-1 text-sm text-muted">Add one script tag and see visitors within seconds.</p>
            <Link href="/sites/new" className="btn mt-4">Add website</Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((s) => {
              const st = byId.get(s.id);
              return (
                <li key={s.id}>
                  <Link href={`/sites/${s.id}`} className="panel block p-5 hover:border-muted">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted">{s.mode}</span>
                    </div>
                    <p className="text-sm text-muted">{s.domain}</p>
                    <p className="mt-4 text-2xl font-semibold tabular-nums">{Number(st?.visitors ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-muted">visitors in the last 24h · <span className="text-good">● {Number(st?.online ?? 0)} online</span></p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
