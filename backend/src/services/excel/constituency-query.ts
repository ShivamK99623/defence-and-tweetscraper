import { createHash } from "crypto";
import { sanitizeSearchQuery, toSqlLikePattern } from "@/lib/search";
import {
  buildCategoryFromClause,
  constituencyExistsExpr,
  entityCategoryExpr,
  qRef,
  qTable,
} from "@/lib/db/pg-sql";
import { queryAll, queryOne } from "@/lib/db/run-query";
import { toEpochMs } from "@/lib/db/timestamps";
import type { MediaType, NewsRecord } from "@/types";
import { normalizeRecord } from "./normalizer";
import {
  mapRowForMediaType,
  getRowSourceKey,
  stripQueryMeta,
} from "./reader-utils";
import {
  buildTableConditions,
  getConfigs,
  type TableQueryConfig,
  API_MAX_PAGE_SIZE,
} from "./query";

const SOURCE_FILE = "postgresql";
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

async function constituencyConfigs(
  mediaType?: MediaType
): Promise<TableQueryConfig[]> {
  const allowed = mediaType
    ? CONSTITUENCY_MEDIA.filter((m) => m === mediaType)
    : CONSTITUENCY_MEDIA;
  return (await getConfigs()).filter((c) => allowed.includes(c.mediaType));
}

function constituencyTextMatchCondition(
  config: TableQueryConfig,
  table: string,
  constituency: string
): { sql: string; params: unknown[] } {
  const pattern = toSqlLikePattern(constituency);
  const parts = config.searchColumns.map(
    (col) =>
      `LOWER(COALESCE(${qRef(table, col)}::text, '')) LIKE ? ESCAPE '\\'`
  );
  return {
    sql: `(${parts.join(" OR ")})`,
    params: config.searchColumns.map(() => pattern),
  };
}

function publicationSortExpr(config: TableQueryConfig, table: string): string {
  if (config.publicationColumn) {
    return `TRIM(COALESCE(${qRef(table, config.publicationColumn)}, ''))`;
  }
  if (config.mediaType === "twitter") {
    return `TRIM(COALESCE(${qRef(table, "handle")}, ''))`;
  }
  if (config.mediaType === "youtube") {
    return `TRIM(COALESCE(${qRef(table, "channel_name")}, ''))`;
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
    ? { sql: constituencyExistsExpr(table), params: [filters.constituency] }
    : constituencyTextMatchCondition(config, table, filters.constituency);

  return {
    sql: [baseWhere, constituencyMatch.sql].join(" AND "),
    params: [...baseParams, ...constituencyMatch.params],
  };
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

function withEpochPublishedAt(record: NewsRecord): NewsRecord {
  if (record.publishedAt === undefined) return record;
  return {
    ...record,
    publishedAt: toEpochMs(record.publishedAt),
  };
}

function rowToConstituencyRecord(
  row: Record<string, unknown>
): NewsRecord | null {
  const entity = row.entity_category as string;
  const mediaType = row.media_type as MediaType;
  const table = row.source_table as string;

  if (!entity || !mediaType || !table) return null;

  const cleaned = stripQueryMeta(row);
  const mapped = mapRowForMediaType(cleaned, mediaType);
  const columns = Object.keys(mapped);
  const sourceId = getRowSourceKey(mapped, mediaType);

  const id = createHash("md5")
    .update(`${table}:${sourceId}:${entity}`)
    .digest("hex");

  const normalized = normalizeRecord({
    row: mapped,
    columns,
    entity,
    mediaType,
    sheetName: entity,
    fileName: SOURCE_FILE,
    rowIndex: 0,
  });

  return withEpochPublishedAt({ ...normalized, id });
}

async function hydrateConstituencyRecord(
  config: TableQueryConfig,
  recordKey: string,
  entity: string
): Promise<NewsRecord | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM ${qTable(config.table)} WHERE ${qRef(config.table, config.idColumn)} = ?`,
    [recordKey]
  );

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

  return withEpochPublishedAt({ ...normalized, id });
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

async function countSingleMedia(
  config: TableQueryConfig,
  filters: ConstituencyFilters
): Promise<number> {
  const { sql: whereSql, params } = buildConstituencyWhere(config, filters);
  const row = await queryOne<{ total: number }>(
    `
      SELECT COUNT(*)::int AS total
      ${buildCategoryFromClause(config, {})}
      WHERE ${whereSql}
    `,
    params
  );
  return row?.total ?? 0;
}

export async function queryConstituencyMediaCounts(
  filters: Omit<ConstituencyFilters, "mediaType" | "sortBy" | "sortOrder">
): Promise<ConstituencyMediaCounts> {
  const normalized = normalizeConstituencyFilters(filters);
  const configs = await constituencyConfigs(undefined);

  const empty: ConstituencyMediaCounts = {
    print: 0,
    online: 0,
    twitter: 0,
    youtube: 0,
  };

  if (configs.length === 0) return empty;

  const results = await Promise.all(
    configs.map(async (config) => {
      const total = await countSingleMedia(config, normalized);
      return [config.mediaType, total] as const;
    })
  );

  const counts = { ...empty };
  for (const [mediaType, total] of results) {
    counts[mediaType] = total;
  }
  return counts;
}

async function querySingleMediaRecords(
  config: TableQueryConfig,
  filters: ConstituencyFilters,
  page: number,
  pageSize: number
): Promise<ConstituencyQueryResult> {
  const table = config.table;
  const { sql: whereSql, params } = buildConstituencyWhere(config, filters);
  const offset = (page - 1) * pageSize;
  const heading = headingColumn(config);
  const entityExpr = entityCategoryExpr(table);
  const fromClause = buildCategoryFromClause(config, {});
  const dateExpr = `${qRef(table, config.dateColumn)}::timestamp`;
  const direction =
    filters.sortOrder?.toLowerCase() === "asc" ? "ASC" : "DESC";

  // ORDER BY must use real expressions — PG does not resolve SELECT aliases
  // inside casts like `sort_date::timestamp` (error 42703).
  let orderExpr: string;
  switch (filters.sortBy) {
    case "heading":
      orderExpr = `TRIM(COALESCE(${qRef(table, heading)}, ''))`;
      break;
    case "sentiment":
      orderExpr = `LOWER(TRIM(COALESCE(${qRef(table, config.sentimentColumn)}, '')))`;
      break;
    case "publication":
      orderExpr = publicationSortExpr(config, table);
      break;
    case "date":
    default:
      orderExpr = dateExpr;
      break;
  }

  const [countRow, rows] = await Promise.all([
    queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total ${fromClause} WHERE ${whereSql}`,
      params
    ),
    queryAll<Record<string, unknown>>(
      `
        SELECT
          '${config.mediaType}' AS media_type,
          '${table}' AS source_table,
          ${entityExpr} AS entity_category,
          ${qRef(table, config.dateColumn)} AS sort_date,
          TRIM(COALESCE(${qRef(table, heading)}, '')) AS sort_heading,
          LOWER(TRIM(COALESCE(${qRef(table, config.sentimentColumn)}, ''))) AS sort_sentiment,
          ${publicationSortExpr(config, table)} AS sort_publication,
          ${qTable(table)}.*
        ${fromClause}
        WHERE ${whereSql}
        ORDER BY ${orderExpr} ${direction}, ${dateExpr} DESC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    ),
  ]);

  const total = countRow?.total ?? 0;
  if (total === 0) {
    return { data: [], total: 0, page, pageSize };
  }

  const data = rows
    .map((row) => rowToConstituencyRecord(row))
    .filter((record): record is NewsRecord => record !== null);

  return { data, total, page, pageSize };
}

async function buildUnionSelect(filters: ConstituencyFilters): Promise<{
  sql: string;
  params: unknown[];
}> {
  const configs = await constituencyConfigs(filters.mediaType);
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
        ${qRef(table, config.idColumn)}::text AS record_key,
        ${entityExpr} AS entity_category,
        ${qRef(table, config.dateColumn)} AS sort_date,
        TRIM(COALESCE(${qRef(table, heading)}, '')) AS sort_heading,
        LOWER(TRIM(COALESCE(${qRef(table, config.sentimentColumn)}, ''))) AS sort_sentiment,
        ${publicationSortExpr(config, table)} AS sort_publication
      ${buildCategoryFromClause(config, {})}
      WHERE ${whereSql}
    `);
    params.push(...whereParams);
  }

  return { sql: parts.join(" UNION ALL "), params };
}

const DEDUPED_CTE = `
  deduped AS (
    SELECT media_type, source_table, record_key, entity_category, sort_date,
           sort_heading, sort_sentiment, sort_publication
    FROM (
      SELECT
        expanded.*,
        ROW_NUMBER() OVER (
          PARTITION BY media_type, record_key
          ORDER BY sort_date::timestamp DESC
        ) AS rn
      FROM expanded
    ) ranked
    WHERE rn = 1
  )
`;

export async function queryConstituencyRecords(
  filters: ConstituencyFilters,
  page = 1,
  pageSize = 20
): Promise<ConstituencyQueryResult> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(pageSize, API_MAX_PAGE_SIZE));
  const normalized = normalizeConstituencyFilters(filters);

  if (normalized.mediaType) {
    const configs = await constituencyConfigs(normalized.mediaType);
    const config = configs[0];
    if (!config) {
      return { data: [], total: 0, page: safePage, pageSize: safePageSize };
    }
    return querySingleMediaRecords(
      config,
      normalized,
      safePage,
      safePageSize
    );
  }

  const { sql: unionSql, params } = await buildUnionSelect(normalized);
  if (unionSql.includes("WHERE 0")) {
    return { data: [], total: 0, page: safePage, pageSize: safePageSize };
  }

  const { column, direction } = resolveSort(
    normalized.sortBy,
    normalized.sortOrder
  );
  const offset = (safePage - 1) * safePageSize;

  const [countRow, refs] = await Promise.all([
    queryOne<{ total: number }>(
      `
        WITH expanded AS (${unionSql}),
        ${DEDUPED_CTE}
        SELECT COUNT(*)::int AS total FROM deduped
      `,
      params
    ),
    queryAll<{
      media_type: MediaType;
      source_table: string;
      record_key: string;
      entity_category: string;
    }>(
      `
        WITH expanded AS (${unionSql}),
        ${DEDUPED_CTE}
        SELECT media_type, source_table, record_key, entity_category
        FROM deduped
        ORDER BY ${column} ${direction}, sort_date::timestamp DESC
        LIMIT ? OFFSET ?
      `,
      [...params, safePageSize, offset]
    ),
  ]);

  const total = countRow?.total ?? 0;
  if (total === 0) {
    return { data: [], total: 0, page: safePage, pageSize: safePageSize };
  }

  const configMap = new Map(
    (await constituencyConfigs(normalized.mediaType)).map((c) => [
      c.mediaType,
      c,
    ])
  );

  const data = (
    await Promise.all(
      refs.map(async (ref) => {
        const config = configMap.get(ref.media_type);
        if (!config) return null;
        return hydrateConstituencyRecord(
          config,
          ref.record_key,
          ref.entity_category
        );
      })
    )
  ).filter((record): record is NewsRecord => record !== null);

  return { data, total, page: safePage, pageSize: safePageSize };
}
