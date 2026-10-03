"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DocsNav({ sections }: { sections: { name: string; pages: { slug: string; title: string }[] }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-6 overflow-x-auto text-sm md:flex-col md:gap-5">
      {sections.map((s) => (
        <div key={s.name} className="shrink-0">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">{s.name}</p>
          <ul className="space-y-0.5">
            {s.pages.map((p) => {
              const active = path === `/docs/${p.slug}`;
              return <li key={p.slug}><Link href={`/docs/${p.slug}`} aria-current={active ? "page" : undefined} className={`block rounded-md px-2 py-1 ${active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-fg"}`}>{p.title}</Link></li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
