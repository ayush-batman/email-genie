"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CircleDollarSign, Funnel, LayoutDashboard, Settings, Target, Users } from "lucide-react";

const ITEMS = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/live", label: "Live", icon: Activity },
  { href: "/visitors", label: "Visitors", icon: Users },
  { href: "/funnels", label: "Funnels", icon: Funnel },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/revenue", label: "Revenue", icon: CircleDollarSign },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SiteNav({ siteId, horizontal = false }: { siteId: string; horizontal?: boolean }) {
  const path = usePathname();
  const base = `/sites/${siteId}`;
  return (
    <nav className={horizontal ? "flex gap-1" : "flex flex-col gap-0.5"}>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href ? path.startsWith(base + href) : path === base;
        return (
          <Link
            key={label}
            href={base + href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors ${active ? "bg-panel font-medium text-fg shadow-[var(--shadow)] ring-1 ring-line" : "text-muted hover:bg-panel/60 hover:text-fg"}`}
          >
            <Icon className={`h-4 w-4 ${active ? "text-accent" : ""}`} />
            {label}
            {label === "Live" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-good" />}
          </Link>
        );
      })}
    </nav>
  );
}
