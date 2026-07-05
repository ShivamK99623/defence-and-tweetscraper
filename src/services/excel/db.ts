import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import type { MediaType } from "@/types";

export const DB_PATH = path.join(process.cwd(), "data", "database.db");

export const MEDIA_TABLES: { table: string; mediaType: MediaType }[] = [
  { table: "print_news", mediaType: "print" },
  { table: "online_news", mediaType: "online" },
  { table: "youtube_news", mediaType: "youtube" },
  { table: "twitter_news", mediaType: "twitter" },
];

let db: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (db) return db;

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database not found: ${DB_PATH}`);
  }

  db = new DatabaseSync(DB_PATH, { readOnly: true });
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function tableExists(tableName: string): boolean {
  const database = getDatabase();
  const row = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    )
    .get(tableName) as { name: string } | undefined;
  return Boolean(row);
}

export function getTableRowCount(tableName: string): number {
  if (!tableExists(tableName)) return 0;
  const database = getDatabase();
  const row = database
    .prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`)
    .get() as { count: number };
  return row.count;
}
