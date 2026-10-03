"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [["/settings/team", "Team"], ["/settings/api", "API & MCP"], ["/settings/billing", "Billing"]] as const;

export function OrgTabs() {
  const path = usePathname();
  return (
    <div className="tabs mb-6">
      {TABS.map(([href, label]) => <Link key={href} href={href} aria-current={path.startsWith(href)} className="tab px-3 py-1.5 text-sm">{label}</Link>)}
    </div>
  );
}
