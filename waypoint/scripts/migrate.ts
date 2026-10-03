import { readFileSync } from "node:fs";
import postgres from "postgres";
import { createClient } from "@clickhouse/client";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {} });
await sql.unsafe(readFileSync("db/postgres.sql", "utf8"));
await sql.end();

const ch = createClient({ request_timeout: 3_600_000, url: process.env.CLICKHOUSE_URL, username: process.env.CLICKHOUSE_USER, password: process.env.CLICKHOUSE_PASSWORD, database: process.env.CLICKHOUSE_DB });
for (const stmt of readFileSync("db/clickhouse.sql", "utf8").split(";").filter((s) => s.trim() && !/^\s*(--[^\n]*\n\s*)*$/.test(s))) await ch.command({ query: stmt });

// One-time backfill of the sessions rollup from events that predate it.
const count = async (q: string) => Number(((await (await ch.query({ query: q, format: "JSONEachRow" })).json()) as { n: string }[])[0]?.n ?? 0);
if ((await count("SELECT count() AS n FROM sessions")) === 0 && (await count("SELECT count() AS n FROM events")) > 0) {
  const select = readFileSync("db/clickhouse.sql", "utf8").split("TO sessions AS")[1]!.trim();
  await ch.command({ query: `INSERT INTO sessions ${select}`, clickhouse_settings: { max_execution_time: 3600 } });
  console.log("backfilled sessions rollup");
}
await ch.close();
console.log("migrations applied");
