import Link from "next/link";
import { logout } from "@/app/actions.ts";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/sites" className="font-semibold">◆ Waypoint</Link>
        <nav className="flex flex-1 flex-wrap items-center gap-4 text-sm">{children}</nav>
        <form action={logout}><button className="text-sm text-muted hover:text-fg">Log out</button></form>
      </div>
    </header>
  );
}
