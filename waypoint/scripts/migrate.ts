import { readFileSync } from "node:fs";
import postgres from "postgres";
import { createClient } from "@clickhouse/client";

const sql = postgres(process.env.DATABASE_URL!);
await sql.unsafe(readFileSync("db/postgres.sql", "utf8"));
await sql.end();

const ch = createClient({ url: process.env.CLICKHOUSE_URL, username: process.env.CLICKHOUSE_USER, password: process.env.CLICKHOUSE_PASSWORD, database: process.env.CLICKHOUSE_DB });
for (const stmt of readFileSync("db/clickhouse.sql", "utf8").split(";").filter((s) => s.trim())) await ch.command({ query: stmt });
await ch.close();
console.log("migrations applied");
