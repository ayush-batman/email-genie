import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DOCS } from "@/components/docs-content.tsx";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = DOCS.find((x) => x.slug === slug);
  return d ? { title: d.title, description: d.description } : {};
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const i = DOCS.findIndex((d) => d.slug === slug);
  if (i < 0) notFound();
  const d = DOCS[i]!;
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const next = DOCS[i + 1];
  return (
    <>
      <p className="text-sm font-medium text-accent">{d.section}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-2 text-lg text-muted">{d.description}</p>
      <div className="mt-6">{d.body(origin)}</div>
      {next && <Link href={`/docs/${next.slug}`} className="panel mt-12 block p-4 hover:border-line-strong"><span className="text-xs text-muted">Next</span><span className="block font-medium">{next.title} →</span></Link>}
    </>
  );
}
