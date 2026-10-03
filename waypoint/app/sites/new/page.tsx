import { AppShell, PageHeader } from "@/components/shell.tsx";
import { SiteForm } from "@/components/site-form.tsx";
import { createSite } from "../../actions.ts";

export const metadata = { title: "Add website" };

export default function NewSitePage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <PageHeader title="Add a website" description="You'll get a tracking snippet on the next step." />
        <div className="panel p-6"><SiteForm action={createSite} submit="Continue" /></div>
      </main>
    </AppShell>
  );
}
