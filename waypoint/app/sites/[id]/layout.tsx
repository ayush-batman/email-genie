import { requireSite } from "@/lib/auth.ts";
import { AppShell } from "@/components/shell.tsx";
import { AskPanel } from "@/components/ask-panel.tsx";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSite(id);
  return (
    <AppShell siteId={id}>
      {children}
      <AskPanel siteId={id} />
    </AppShell>
  );
}
