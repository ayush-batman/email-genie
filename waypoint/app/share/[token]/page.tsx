import Link from "next/link";
import { notFound } from "next/navigation";
import { siteByShareToken } from "@/lib/auth.ts";
import { Dashboard } from "@/components/dashboard.tsx";

export default async function SharedDashboard({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const site = await siteByShareToken(token);
  if (!site) notFound();
  return (
    <>
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 text-sm">
          <Link href="/" className="font-semibold">◆ Waypoint</Link>
          <span className="font-medium">{site.name}</span>
          <span className="hidden text-muted sm:inline">Shared dashboard (read-only)</span>
          <Link href="/signup" className="btn ml-auto">Start free trial</Link>
        </div>
      </header>
      <Dashboard site={site} sp={await searchParams} basePath={`/share/${token}`} readOnly />
    </>
  );
}
