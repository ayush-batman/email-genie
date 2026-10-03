import Link from "next/link";
import { notFound } from "next/navigation";
import { siteByShareToken } from "@/lib/auth.ts";
import { Dashboard } from "@/components/dashboard.tsx";
import { Logo } from "@/components/logo.tsx";
import { Favicon } from "@/components/shell.tsx";

export default async function SharedDashboard({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const site = await siteByShareToken(token);
  if (!site) notFound();
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3 sm:px-8">
          <Link href="/"><Logo /></Link>
          <span className="text-line-strong">/</span>
          <Favicon domain={site.domain} />
          <span className="truncate font-medium">{site.domain}</span>
          <span className="chip hidden bg-subtle text-muted sm:inline-flex">Public dashboard</span>
          <Link href="/signup" className="btn ml-auto">Get your own</Link>
        </div>
      </header>
      <Dashboard site={site} sp={await searchParams} basePath={`/share/${token}`} readOnly />
    </>
  );
}
