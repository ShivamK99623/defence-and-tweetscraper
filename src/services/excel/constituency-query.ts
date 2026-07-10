import { createHash } from "crypto";
import { sanitizeSearchQuery, toSqlLikePattern } from "@/lib/search";
import type { MediaType, NewsRecord } from "@/types";
import { normalizeRecord } from "./normalizer";
import { mapRowForMediaType, getRowSourceKey } from "./reader-utils";
import { getDatabase, tableExists } from "./db";
import {
  buildTableConditions,
  buildCategoryFromClause,
  entityCategoryExpr,
  getConfigs,
  type TableQueryConfig,
  API_MAX_PAGE_SIZE,
} from "./query";

const SOURCE_FILE = "database.db";
const CONSTITUENCY_COLUMN_MEDIA: MediaType[] = ["print", "online"];
const CONSTITUENCY_TEXT_MEDIA: MediaType[] = ["twitter", "youtube"];
const CONSTITUENCY_MEDIA: MediaType[] = [
  ...CONSTITUENCY_COLUMN_MEDIA,
  ...CONSTITUENCY_TEXT_MEDIA,
];

export interface ConstituencyFilters {
  constituency: string;
  mediaType?: MediaType;
  sentiment?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

function constituencyConfigs(mediaType?: MediaType): TableQueryConfig[] {
  const allowed = mediaType
    ? CONSTITUENCY_MEDIA.filter((m) => m === mediaType)
    : CONSTITUENCY_MEDIA;
  return getConfigs().filter(
    (c) => allowed.includes(c.mediaType) && tableExists(c.table)
  );
}

function constituencyCondition(table: string): string {
  return `EXISTS (
    SELECT 1 FROM json_each(COALESCE(${table}.constituency, '[]')) AS ce
    WHERE ce.value = ?
  )`;
}

function constituencyTextMatchCondition(
  config: TableQueryConfig,
  table: string,
  constituency: string
): { sql: string; params: unknown[] } {
  const pattern = toSqlLikePattern(constituency);
  const parts = config.searchColumns.map(
    (col) => `LOWER(COALESCE(${table}.${col}, '')) LIKE ? ESCAPE '\\'`
  );
  return {
    sql: `(${parts.join(" OR ")})`,
    params: config.searchColumns.map(() => pattern),
  };
}

function publicationSortExpr(config: TableQueryConfig, table: string): string {
  if (config.publicationColumn) {
    return `TRIM(COALESCE(${table}.${config.publicationColumn}, ''))`;
  }
  if (config.mediaType === "twitter") {
    return `TRIM(COALESCE(${table}.handle, ''))`;
  }
  if (config.mediaType === "youtube") {
    return `TRIM(COALESCE(${table}.channel_name, ''))`;
  }
  return "''";
}

function headingColumn(config: TableQueryConfig): string {
  if (config.mediaType === "youtube") return "title_english";
  if (config.mediaType === "twitter") return "headline";
  return "heading";
}

function buildConstituencyWhere(
  config: TableQueryConfig,
  filters: ConstituencyFilters
): { sql: string; params: unknown[] } {
  const table = config.table;
  const baseFilters = {
    sentiment: filters.sentiment,
    startDate: filters.startDate,
    endDate: filters.endDate,
    search: filters.search,
  };

  const { sql: baseWhere, params: baseParams } = buildTableConditions(
    config,
    baseFilters
  );

  const constituencyMatch = CONSTITUENCY_COLUMN_MEDIA.includes(config.mediaType)
    ? { sql: constituencyCondition(table), params: [filters.constituency] }
    : constituencyTextMatchCondition(config, table, filters.constituency);

  const conditions = [baseWhere, constituencyMatch.sql];
  const params = [...baseParams, ...constituencyMatch.params];

  return { sql: conditions.join(" AND "), params };
}

function buildUnionSelect(filters: ConstituencyFilters): {
  sql: string;
  params: unknown[];
} {
  const configs = constituencyConfigs(filters.mediaType);
  if (configs.length === 0) {
    return { sql: "SELECT NULL AS media_type WHERE 0", params: [] };
  }

  const parts: string[] = [];
  const params: unknown[] = [];

  for (const config of configs) {
    const table = config.table;
    const { sql: whereSql, params: whereParams } = buildConstituencyWhere(
      config,
      filters
    );
    const heading = headingColumn(config);

    const entityExpr = entityCategoryExpr(table);

    parts.push(`
      SELECT
        '${config.mediaType}' AS media_type,
        '${table}' AS source_table,
        CAST(${table}.${config.idColumn} AS TEXT) AS record_key,
        ${entityExpr} AS entity_category,
        ${table}.${config.dateColumn} AS sort_date,
        TRIM(COALESCE(${table}.${heading}, '')) AS sort_heading,
        LOWER(TRIM(COALESCE(${table}.${config.sentimentColumn}, ''))) AS sort_sentiment,
        ${publicationSortExpr(config, table)} AS sort_publication
      ${buildCategoryFromClause(config, {})}
      WHERE ${whereSql}
    `);
    params.push(...whereParams);
  }

  return { sql: parts.join(" UNION ALL "), params };
}

function resolveSort(
  sortBy: string | undefined,
  sortOrder: string | undefined
): { column: string; direction: "ASC" | "DESC" } {
  const direction = sortOrder?.toLowerCase() === "asc" ? "ASC" : "DESC";
  switch (sortBy) {
    case "heading":
      return { column: "sort_heading", direction };
    case "sentiment":
      return { column: "sort_sentiment", direction };
    case "publication":
      return { column: "sort_publication", direction };
    case "date":
    default:
      return { column: "sort_date", direction };
  }
}

function hydrateConstituencyRecord(
  config: TableQueryConfig,
  recordKey: string,
  entity: string
): NewsRecord | null {
  const database = getDatabase();
  const row = database
    .prepare(`SELECT * FROM ${config.table} WHERE ${config.idColumn} = ?`)
    .get(recordKey) as Record<string, unknown> | undefined;

  if (!row) return null;

  const mapped = mapRowForMediaType(row, config.mediaType);
  const columns = Object.keys(mapped);
  const sourceId = getRowSourceKey(mapped, config.mediaType);
  const id = createHash("md5")
    .update(`${config.table}:${sourceId}:${entity}`)
    .digest("hex");

  const normalized = normalizeRecord({
    row: mapped,
    columns,
    entity,
    mediaType: config.mediaType,
    sheetName: entity,
    fileName: SOURCE_FILE,
    rowIndex: 0,
  });

  return { ...normalized, id };
}

export interface ConstituencyQueryResult {
  data: NewsRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export type ConstituencyMediaCounts = Record<MediaType, number>;

function normalizeConstituencyFilters(
  filters: ConstituencyFilters
): ConstituencyFilters {
  return {
    ...filters,
    search: filters.search
      ? sanitizeSearchQuery(filters.search)
      : undefined,
  };
}

export function queryConstituencyMediaCounts(
  filters: Omit<ConstituencyFilters, "mediaType" | "sortBy" | "sortOrder">
): ConstituencyMediaCounts {
  const database = getDatabase();
  const normalized = normalizeConstituencyFilters(filters);
  const { sql: unionSql, params } = buildUnionSelect({
    ...normalized,
    mediaType: undefined,
  });

  const empty: ConstituencyMediaCounts = {
    print: 0,
    online: 0,
    twitter: 0,
    youtube: 0,
  };

  if (unionSql.includes("WHERE 0")) {
    return empty;
  }

  const rows = database
    .prepare(
      `
      WITH expanded AS (${unionSql}),
      deduped AS (
        SELECT media_type, record_key
        FROM (
          SELECT
            expanded.*,
            ROW_NUMBER() OVER (
              PARTITION BY media_type, record_key
              ORDER BY datetime(sort_date) DESC
            ) AS rn
          FROM expanded
        )
        WHERE rn = 1
      )
      SELECT media_type, COUNT(*) AS count
      FROM deduped
      GROUP BY media_type
    `
    )
    .all(...params) as { media_type: MediaType; count: number }[];

  const counts = { ...empty };
  for (const row of rows) {
    counts[row.media_type] = row.count;
  }
  return counts;
}

export function queryConstituencyRecords(
  filters: ConstituencyFilters,
  page = 1,
  pageSize = 20
): ConstituencyQueryResult {
  const database = getDatabase();
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(pageSize, API_MAX_PAGE_SIZE));

  const normalized: ConstituencyFilters = normalizeConstituencyFilters(filters);

  const { sql: unionSql, params } = buildUnionSelect(normalized);
  if (unionSql.includes("WHERE 0")) {
    return { data: [], total: 0, page: safePage, pageSize: safePageSize };
  }

  const countRow = database
    .prepare(
      `
      WITH expanded AS (${unionSql}),
      deduped AS (
        SELECT media_type, record_key, entity_category
        FROM (
          SELECT
            expanded.*,
            ROW_NUMBER() OVER (
              PARTITION BY media_type, record_key
              ORDER BY datetime(sort_date) DESC
            ) AS rn
          FROM expanded
        )
        WHERE rn = 1
      )
      SELECT COUNT(*) AS total FROM deduped
    `
    )
    .get(...params) as { total: number };

  const total = countRow?.total ?? 0;
  if (total === 0) {
    return { data: [], total: 0, page: safePage, pageSize: safePageSize };
  }

  const { column, direction } = resolveSort(
    normalized.sortBy,
    normalized.sortOrder
  );
  const offset = (safePage - 1) * safePageSize;

  const refs = database
    .prepare(
      `
      WITH expanded AS (${unionSql}),
      deduped AS (
        SELECT media_type, source_table, record_key, entity_category, sort_date,
               sort_heading, sort_sentiment, sort_publication
        FROM (
          SELECT
            expanded.*,
            ROW_NUMBER() OVER (
              PARTITION BY media_type, record_key
              ORDER BY datetime(sort_date) DESC
            ) AS rn
          FROM expanded
        )
        WHERE rn = 1
      )
      SELECT media_type, source_table, record_key, entity_category
      FROM deduped
      ORDER BY ${column} ${direction}, datetime(sort_date) DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(...params, safePageSize, offset) as {
    media_type: MediaType;
    source_table: string;
    record_key: string;
    entity_category: string;
  }[];

  const configMap = new Map(
    constituencyConfigs(normalized.mediaType).map((c) => [c.mediaType, c])
  );

  const data: NewsRecord[] = [];
  for (const ref of refs) {
    const config = configMap.get(ref.media_type);
    if (!config) continue;

    const record = hydrateConstituencyRecord(
      config,
      ref.record_key,
      ref.entity_category
    );
    if (record) data.push(record);
  }

  return { data, total, page: safePage, pageSize: safePageSize };
}
