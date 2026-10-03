import Link from "next/link";
import { DOCS } from "@/components/docs-content.tsx";

export const metadata = { title: "Docs" };

export default function DocsIndex() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>
      <p className="mt-2 text-muted">Install the script, track what matters, connect revenue and query it all from code or AI tools.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {DOCS.map((d) => (
          <Link key={d.slug} href={`/docs/${d.slug}`} className="panel p-4 transition hover:border-line-strong">
            <p className="font-medium">{d.title}</p>
            <p className="mt-1 text-sm text-muted">{d.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
