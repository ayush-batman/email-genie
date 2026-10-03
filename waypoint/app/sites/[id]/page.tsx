import { requireSite } from "@/lib/auth.ts";
import { Dashboard } from "@/components/dashboard.tsx";

export default async function SiteDashboard({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const { site } = await requireSite(id);
  return <Dashboard site={site} sp={await searchParams} basePath={`/sites/${id}`} />;
}
