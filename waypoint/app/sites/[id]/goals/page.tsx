import { Target, Trash2 } from "lucide-react";
import { requireSite } from "@/lib/auth.ts";
import { sql } from "@/lib/db.ts";
import { resolvePeriod } from "@/lib/dates.ts";
import { breakdown, goalStats, type Goal } from "@/lib/stats.ts";
import { compact, pct } from "@/lib/format.ts";
import { PageHeader } from "@/components/shell.tsx";
import { GoalForm } from "@/components/goal-form.tsx";
import { createGoal, deleteGoal } from "../../../actions.ts";

export const metadata = { title: "Goals" };

export default async function GoalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { site, role } = await requireSite((await params).id);
  const goals = await sql<Goal[]>`SELECT id, name, kind, match FROM goals WHERE site_id = ${site.id} ORDER BY created_at`;
  const scope = { siteId: site.id, tz: site.timezone, range: resolvePeriod("30d", site.timezone), filters: [], currency: site.currency };
  const [stats, events] = await Promise.all([goalStats(scope, goals), breakdown(scope, "event", 20)]);
  const best = Math.max(0.0001, ...stats.map((s) => s.rate));

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <PageHeader title="Goals" description="The actions that matter. Conversion rate = visitors who completed the goal ÷ all visitors, last 30 days." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="panel overflow-hidden">
          {stats.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent"><Target className="h-6 w-6" /></span>
              <p className="mt-4 font-medium">No goals yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted">Add a goal for a signup, purchase or key page to see its conversion rate on your dashboard.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {stats.map((g) => (
                <li key={g.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Target className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-muted">{g.kind === "event" ? "Event" : "Page"} · <code>{g.match}</code></p>
                    <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-accent" style={{ width: `${(g.rate / best) * 100}%` }} /></div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">{pct(g.rate)}</p>
                    <p className="text-xs text-muted tabular-nums">{compact(g.visitors)} visitors · {compact(g.completions)} times</p>
                  </div>
                  {role !== "viewer" && (
                    <form action={deleteGoal.bind(null, site.id, g.id)}>
                      <button className="rounded-md p-2 text-faint hover:bg-bad-soft hover:text-bad" aria-label={`Delete goal ${g.name}`}><Trash2 className="h-4 w-4" /></button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        {role !== "viewer" && (
          <aside className="panel h-fit p-5">
            <h2 className="mb-4 font-semibold">New goal</h2>
            <GoalForm action={createGoal.bind(null, site.id)} suggestions={events.map((e) => e.value)} />
          </aside>
        )}
      </div>
    </main>
  );
}
