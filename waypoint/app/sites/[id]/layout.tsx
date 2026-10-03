import { requireSite } from "@/lib/auth.ts";
import { AppShell } from "@/components/shell.tsx";
import { AskPanel } from "@/components/ask-panel.tsx";
import { Paywall } from "@/components/paywall.tsx";
import { sql } from "@/lib/db.ts";
import { accessState } from "@/lib/plans.ts";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireSite(id);
  const [org] = await sql<{ plan: string; trial_ends_at: Date; subscription_status: string | null }[]>`SELECT plan, trial_ends_at, subscription_status FROM organizations WHERE id = ${site.org_id}`;
  const state = accessState(org!);
  if (state === "trial_expired" || state === "canceled") return <AppShell siteId={id}><Paywall state={state} /></AppShell>;
  return (
    <AppShell siteId={id}>
      {children}
      <AskPanel siteId={id} />
    </AppShell>
  );
}
