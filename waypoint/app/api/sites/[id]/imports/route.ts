import { audit, canEdit, requireSite } from "@/lib/auth.ts";
import { IMPORT_PROVIDERS, type ImportProvider } from "@/lib/importers.ts";
import { startImport } from "@/lib/import-job.ts";

const MAX_BYTES = 100 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { site, role, user } = await requireSite((await params).id);
  if (!canEdit(role)) return Response.json({ error: "Only owners and admins can import data" }, { status: 403 });
  const form = await req.formData();
  const provider = String(form.get("provider"));
  if (!(provider in IMPORT_PROVIDERS)) return Response.json({ error: "Choose a source" }, { status: 400 });
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return Response.json({ error: "Choose at least one file" }, { status: 400 });
  if (files.reduce((a, f) => a + f.size, 0) > MAX_BYTES) return Response.json({ error: "Files are larger than 100 MB in total. Split the export by date range." }, { status: 413 });
  const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
  try {
    const id = await startImport(site.id, user.id, provider as ImportProvider, texts, form.get("only_before") === "on");
    await audit(site.org_id, user.id, "import.started", `${provider} · ${site.domain}`);
    return Response.json({ id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
