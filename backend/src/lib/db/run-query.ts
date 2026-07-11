import type { QueryResultRow } from "pg";
import { getPool } from "@/config/db";

export function toPgParams(
  sql: string,
  params: unknown[]
): { text: string; values: unknown[] } {
  let index = 0;
  const text = sql.replace(/\?/g, () => `$${++index}`);
  return { text, values: params };
}

export async function queryAll<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const { text, values } = toPgParams(sql, params);
  const result = await getPool().query<T>(text, values);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await queryAll<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<number> {
  const { text, values } = toPgParams(sql, params);
  const result = await getPool().query(text, values);
  return result.rowCount ?? 0;
}
