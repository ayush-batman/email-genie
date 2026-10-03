import Link from "next/link";
import { DOCS } from "@/components/docs-content.tsx";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-header.tsx";
import { DocsNav } from "@/components/docs-nav.tsx";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const sections = [...new Set(DOCS.map((d) => d.section))].map((s) => ({ name: s, pages: DOCS.filter((d) => d.section === s).map(({ slug, title }) => ({ slug, title })) }));
  return (
    <>
      <SiteHeader />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-8 md:grid-cols-[200px_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <Link href="/docs" className="mb-4 block font-semibold">Documentation</Link>
          <DocsNav sections={sections} />
        </aside>
        <article className="min-w-0 max-w-3xl pb-16">{children}</article>
      </div>
      <SiteFooter />
    </>
  );
}
