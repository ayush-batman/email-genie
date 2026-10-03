import postgres from "postgres";
import { createClient, type ClickHouseClient } from "@clickhouse/client";

const g = globalThis as unknown as { __sql?: postgres.Sql; __ch?: ClickHouseClient };

export const sql = (g.__sql ??= postgres(process.env.DATABASE_URL!, { max: 10 }));

export const ch = (g.__ch ??= createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
  database: process.env.CLICKHOUSE_DB,
  clickhouse_settings: { date_time_input_format: "best_effort" },
}));

export async function chQuery<T>(query: string, params: Record<string, unknown>): Promise<T[]> {
  const rs = await ch.query({ query, query_params: params, format: "JSONEachRow" });
  return rs.json<T>();
}

export type Site = {
  id: string;
  org_id: string;
  public_id: string;
  name: string;
  domain: string;
  mode: "private" | "product";
  timezone: string;
  share_token: string | null;
  created_at: Date;
};
