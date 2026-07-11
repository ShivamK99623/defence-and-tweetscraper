import type { MediaType } from "@/types";
import { qTable } from "@/lib/db/pg-sql";
import { queryOne } from "@/lib/db/run-query";

export const MEDIA_TABLES: { table: string; mediaType: MediaType }[] = [
  { table: "print_news", mediaType: "print" },
  { table: "online_news", mediaType: "online" },
  { table: "youtube_news", mediaType: "youtube" },
  { table: "twitter_news", mediaType: "twitter" },
];

const knownTables = new Set(MEDIA_TABLES.map((entry) => entry.table));

export async function tableExists(tableName: string): Promise<boolean> {
  if (!knownTables.has(tableName)) {
    return false;
  }

  const row = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ?
    ) AS exists`,
    [tableName]
  );

  return Boolean(row?.exists);
}

export async function getTableRowCount(tableName: string): Promise<number> {
  if (!(await tableExists(tableName))) {
    return 0;
  }

  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${qTable(tableName)}`
  );
  return Number(row?.count ?? 0);
}
