// Runs an import: parse → map → (optionally) drop overlap with native data → insert tagged with import_id.
import { ch, chQuery, sql } from "./db.ts";
import { parseCsv } from "./csv.ts";
import { mapDatabuddy, mapUmami, mapVercel, pinSessionSources, type ImportProvider } from "./importers.ts";

export type UploadedFile = { name: string; text: string };

function mapFiles(provider: ImportProvider, files: UploadedFile[]) {
  if (provider === "vercel") return files.flatMap((f) => mapVercel(f.text));
  if (provider === "databuddy") {
    const ev = files.find((f) => /events/i.test(f.name)) ?? files[0];
    if (!ev) throw new Error("Upload events.csv from the Databuddy export");
    return mapDatabuddy(parseCsv(ev.text));
  }
  const pick = (re: RegExp) => files.find((f) => re.test(f.name));
  const events = pick(/website_event/i) ?? files.find((f) => !/session|event_data/i.test(f.name));
  if (!events) throw new Error("Upload website_event.csv from the Umami export");
  return mapUmami(parseCsv(events.text), parseCsv(pick(/session/i)?.text ?? ""), parseCsv(pick(/event_data/i)?.text ?? ""));
}

/**
 * Starts an import and returns its id; the work continues in the background.
 * ponytail: runs in-process and holds uploads in memory (fine to ~100 MB); move to a queue + object storage for bigger histories.
 */
export async function startImport(siteId: string, userId: string, provider: ImportProvider, files: UploadedFile[], onlyBeforeNative: boolean): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO imports (site_id, provider, files, created_by) VALUES (${siteId}, ${provider}, ${files.map((f) => f.name).join(", ")}, ${userId}) RETURNING id`;
  const id = row!.id;
  void run(id, siteId, provider, files, onlyBeforeNative).catch(async (e) => {
    console.error("import failed", e);
    await sql`UPDATE imports SET status = 'failed', error = ${String((e as Error).message ?? e).slice(0, 500)} WHERE id = ${id}`;
  });
  return id;
}

async function run(id: string, siteId: string, provider: ImportProvider, files: UploadedFile[], onlyBeforeNative: boolean) {
  const mapped = pinSessionSources(mapFiles(provider, files));
  let cutoff: string | null = null;
  if (onlyBeforeNative) {
    const [r] = await chQuery<{ t: string; n: string }>(
      `SELECT toString(min(ts)) AS t, count() AS n FROM events WHERE site_id = {site:UUID} AND import_id = ''`, { site: siteId });
    if (r && Number(r.n) > 0) cutoff = new Date(r.t.replace(" ", "T") + "Z").toISOString();
  }
  const rows = cutoff ? mapped.filter((r) => r.ts < cutoff!) : mapped;
  const times = rows.map((r) => r.ts).sort();
  await sql`UPDATE imports SET rows_total = ${mapped.length}, rows_skipped = ${mapped.length - rows.length},
              date_from = ${times[0] ?? null}, date_to = ${times.at(-1) ?? null} WHERE id = ${id}`;
  const BATCH = 20_000;
  for (let i = 0; i < rows.length; i += BATCH) {
    await ch.insert({ table: "events", values: rows.slice(i, i + BATCH).map((r) => ({ ...r, site_id: siteId, import_id: id })), format: "JSONEachRow" });
    await sql`UPDATE imports SET rows_imported = ${Math.min(rows.length, i + BATCH)} WHERE id = ${id}`;
  }
  await sql`UPDATE imports SET status = 'done' WHERE id = ${id}`;
}

export async function deleteImport(siteId: string, id: string) {
  for (const table of ["events", "sessions"])
    await ch.command({ query: `ALTER TABLE ${table} DELETE WHERE site_id = {site:UUID} AND import_id = {id:String}`, query_params: { site: siteId, id }, clickhouse_settings: { mutations_sync: "1" } });
  await sql`DELETE FROM imports WHERE id = ${id} AND site_id = ${siteId}`;
}
