import { requireUser } from "@/lib/auth.ts";
import { AppHeader } from "@/components/app-header.tsx";
import { SiteForm } from "@/components/site-form.tsx";
import { createSite } from "../../actions.ts";

export const metadata = { title: "Add website" };

export default async function NewSitePage() {
  await requireUser();
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Add a website</h1>
        <div className="panel p-6"><SiteForm action={createSite} submit="Add website" /></div>
      </main>
    </>
  );
}
