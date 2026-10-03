import Link from "next/link";
import { currentUser } from "@/lib/auth.ts";
import { Logo } from "@/components/logo.tsx";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-8">
        <Link href="/"><Logo /></Link>
        <nav className="hidden items-center gap-5 text-sm text-muted sm:flex">
          <Link href="/pricing" className="hover:text-fg">Pricing</Link>
          <Link href="/docs" className="hover:text-fg">Docs</Link>
          <Link href="/share/demo" className="hover:text-fg">Live demo</Link>
        </nav>
        <nav className="ml-auto flex items-center gap-2 text-sm sm:gap-4">
          {user ? <Link href="/sites" className="btn">Open dashboard</Link> : <><Link href="/login" className="px-2 text-muted hover:text-fg">Log in</Link><Link href="/signup" className="btn">Start free trial</Link></>}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-8 text-sm text-muted sm:px-8">
        <Logo className="text-fg" />
        <Link href="/pricing" className="hover:text-fg">Pricing</Link>
        <Link href="/docs" className="hover:text-fg">Docs</Link>
        <Link href="/docs/privacy" className="hover:text-fg">Privacy</Link>
        <span className="ml-auto">© {new Date().getFullYear()} Waypoint</span>
      </div>
    </footer>
  );
}
