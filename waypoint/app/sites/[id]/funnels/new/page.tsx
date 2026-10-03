import Link from "next/link";
import { requireSite } from "@/lib/auth.ts";
import { resolvePeriod } from "@/lib/dates.ts";
import { breakdown } from "@/lib/stats.ts";
import { PageHeader } from "@/components/shell.tsx";
import { FunnelBuilder } from "@/components/funnel-builder.tsx";
import { saveFunnel } from "../../../../actions.ts";

export const metadata = { title: "New funnel" };

export default async function NewFunnel({ params }: { params: Promise<{ id: string }> }) {
  const { site } = await requireSite((await params).id);
  const scope = { siteId: site.id, tz: site.timezone, range: resolvePeriod("30d", site.timezone), filters: [] };
  const [pages, events] = await Promise.all([breakdown(scope, "page", 50), breakdown(scope, "event", 50)]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
      <Link href={`/sites/${site.id}/funnels`} className="text-sm text-muted hover:text-fg">← Funnels</Link>
      <div className="mt-4"><PageHeader title="New funnel" description="Add the steps visitors take on the way to converting." /></div>
      <div className="panel p-6"><FunnelBuilder action={saveFunnel.bind(null, site.id, null)} pages={pages.map((p) => p.value)} events={events.map((e) => e.value)} /></div>
    </main>
  );
}
