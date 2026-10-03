import Link from "next/link";
import { requireSite } from "@/lib/auth.ts";
import { AppHeader } from "@/components/app-header.tsx";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireSite(id);
  return (
    <>
      <AppHeader>
        <span className="font-medium">{site.name}</span>
        <Link href={`/sites/${id}`} className="text-muted hover:text-fg">Dashboard</Link>
        <Link href={`/sites/${id}/live`} className="text-muted hover:text-fg">Live</Link>
        <Link href={`/sites/${id}/settings`} className="text-muted hover:text-fg">Settings</Link>
      </AppHeader>
      {children}
    </>
  );
}
