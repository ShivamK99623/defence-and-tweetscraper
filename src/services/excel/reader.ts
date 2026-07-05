import { createHash } from "crypto";
import path from "path";
import { DEFENCE_ENTITIES } from "@/constants";
import type { DefenceEntity, MediaType, NewsRecord } from "@/types";
import { normalizeRecord } from "./normalizer";
import {
  mapRowForMediaType,
  parseCategories,
} from "./reader-utils";
import {
  DB_PATH,
  MEDIA_TABLES,
  getDatabase,
  getTableRowCount,
  tableExists,
} from "./db";

const SOURCE_FILE = path.basename(DB_PATH);

export interface RawSheetData {
  fileName: string;
  mediaType: MediaType;
  sheetName: string;
  entity: DefenceEntity;
  columns: string[];
  rows: Record<string, unknown>[];
}

function getRowSourceId(
  row: Record<string, unknown>,
  mediaType: MediaType,
  rowIndex: number
): string {
  if (mediaType === "print" || mediaType === "online") {
    return String(row.newsId ?? rowIndex);
  }

  return String(row.id ?? rowIndex);
}

function queryTableRows(table: string): Record<string, unknown>[] {
  const database = getDatabase();
  return database.prepare(`SELECT * FROM "${table}"`).all() as Record<
    string,
    unknown
  >[];
}

function rowsToRecords(
  rows: Record<string, unknown>[],
  mediaType: MediaType,
  table: string
): NewsRecord[] {
  const records: NewsRecord[] = [];

  rows.forEach((rawRow, rowIndex) => {
    const categories = parseCategories(rawRow.category);
    if (categories.length === 0) return;

    const row = mapRowForMediaType(rawRow, mediaType);
    const columns = Object.keys(row);
    const sourceId = getRowSourceId(row, mediaType, rowIndex);

    for (const entity of categories) {
      const id = createHash("md5")
        .update(`${table}:${sourceId}:${entity}`)
        .digest("hex");

      const normalized = normalizeRecord({
        row,
        columns,
        entity,
        mediaType,
        sheetName: entity,
        fileName: SOURCE_FILE,
        rowIndex,
      });

      records.push({ ...normalized, id });
    }
  });

  return records;
}

export function readAllWorkbooks(): RawSheetData[] {
  const results: RawSheetData[] = [];

  for (const { table, mediaType } of MEDIA_TABLES) {
    if (!tableExists(table)) continue;

    const rows = queryTableRows(table);
    if (rows.length === 0) continue;

    for (const entity of DEFENCE_ENTITIES) {
      const entityRows = rows
        .filter((row) => parseCategories(row.category).includes(entity))
        .map((row) => mapRowForMediaType(row, mediaType));

      if (entityRows.length === 0) continue;

      results.push({
        fileName: SOURCE_FILE,
        mediaType,
        sheetName: entity,
        entity,
        columns: Object.keys(entityRows[0] ?? {}),
        rows: entityRows,
      });
    }
  }

  return results;
}

export function loadAllRecords(): NewsRecord[] {
  const records: NewsRecord[] = [];

  for (const { table, mediaType } of MEDIA_TABLES) {
    if (!tableExists(table)) continue;

    const rows = queryTableRows(table);
    records.push(...rowsToRecords(rows, mediaType, table));
  }

  return records;
}

export function getAvailableWorkbooks(): string[] {
  return MEDIA_TABLES.filter(({ table }) => getTableRowCount(table) > 0).map(
    ({ table }) => table
  );
}
