import { AppShell } from "@/components/shell.tsx";
import { OrgTabs } from "@/components/org-tabs.tsx";

export default function OrgSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <main className="mx-auto max-w-[1000px] px-4 py-8 sm:px-8">
        <h1 className="mb-4 text-xl font-semibold tracking-tight">Team settings</h1>
        <OrgTabs />
        {children}
      </main>
    </AppShell>
  );
}
