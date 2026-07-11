import { createHash } from "crypto";
import { sanitizeSearchQuery, toSqlLikePattern } from "@/lib/search";
import {
  buildCategoryFromClause,
  entityCategoryExpr,
  pgDateExpr,
  pgDateTimeExpr,
  qIdent,
  qRef,
  qTable,
} from "@/lib/db/pg-sql";
import { queryAll, queryOne } from "@/lib/db/run-query";
import { toEpochMs } from "@/lib/db/timestamps";
import type { MediaType, NewsFilters, NewsRecord } from "@/types";
import { normalizeRecord } from "./normalizer";
import {
  mapRowForMediaType,
  stripQueryMeta,
  getRowSourceKey,
} from "./reader-utils";
import { tableExists } from "./db";

export const EXPORT_BATCH_SIZE = 500;
export const MAX_EXPORT_ROWS = 50_000;
export const API_MAX_PAGE_SIZE = 100;

export interface TableQueryConfig {
  table: string;
  mediaType: MediaType;
  dateColumn: string;
  dateStoredAsUtc?: boolean;
  idColumn: string;
  sentimentColumn: string;
  languageColumn: string;
  publicationColumn?: string;
  editionColumn?: string;
  searchColumns: string[];
}

export const TABLE_CONFIGS: TableQueryConfig[] = [
  {
    table: "print_news",
    mediaType: "print",
    dateColumn: "createdAt",
    idColumn: "newsId",
    sentimentColumn: "sentiment",
    languageColumn: "languageName",
    publicationColumn: "publicationName",
    editionColumn: "editionName",
    // `authors` is jsonb — excluded from search (expensive + not desired)
    searchColumns: ["heading", "summary", "content"],
  },
  {
    table: "online_news",
    mediaType: "online",
    dateColumn: "createdAt",
    idColumn: "newsId",
    sentimentColumn: "sentiment",
    languageColumn: "languageName",
    publicationColumn: "publicationName",
    editionColumn: "editionName",
    searchColumns: ["heading", "summary", "content"],
  },
  {
    table: "youtube_news",
    mediaType: "youtube",
    dateColumn: "postedTime",
    dateStoredAsUtc: true,
    idColumn: "youtubeId",
    sentimentColumn: "sentiment",
    languageColumn: "language",
    searchColumns: ["title_english", "english_summary"],
  },
  {
    table: "twitter_news",
    mediaType: "twitter",
    dateColumn: "postedTime",
    dateStoredAsUtc: true,
    idColumn: "newsId",
    sentimentColumn: "sentiment",
    languageColumn: "language",
    searchColumns: ["headline", "summary"],
  },
];

interface SqlParts {
  sql: string;
  params: unknown[];
}

interface PageRefRow {
  media_type: MediaType;
  source_table: string;
  record_key: string;
  entity_category: string;
  sort_date: string | Date;
}

const SOURCE_FILE = "postgresql";

export function isEntityScoped(filters: NewsFilters): boolean {
  return Boolean(filters.entity);
}

const CONFIG_CACHE_TTL_MS = 60_000;
let configCache: { expiresAt: number; configs: TableQueryConfig[] } | null =
  null;

export async function getConfigs(
  mediaType?: MediaType
): Promise<TableQueryConfig[]> {
  const now = Date.now();
  if (!configCache || now >= configCache.expiresAt) {
    const available: TableQueryConfig[] = [];
    for (const config of TABLE_CONFIGS) {
      if (await tableExists(config.table)) {
        available.push(config);
      }
    }
    configCache = {
      expiresAt: now + CONFIG_CACHE_TTL_MS,
      configs: available,
    };
  }

  if (mediaType) {
    return configCache.configs.filter((c) => c.mediaType === mediaType);
  }
  return configCache.configs;
}

export function sqlDateExpr(config: TableQueryConfig, table: string): string {
  return pgDateExpr(config, table);
}

export function buildTableOnlyConditions(
  config: TableQueryConfig,
  filters: NewsFilters
): SqlParts {
  const table = config.table;
  const conditions: string[] = ["1 = 1"];
  const params: unknown[] = [];

  if (filters.sentiment) {
    conditions.push(
      `LOWER(TRIM(COALESCE(${qRef(table, config.sentimentColumn)}, ''))) = ?`
    );
    params.push(filters.sentiment.toLowerCase());
  }

  if (filters.language) {
    conditions.push(`LOWER(${qRef(table, config.languageColumn)}) = ?`);
    params.push(filters.language.toLowerCase());
  }

  if (filters.publication && config.publicationColumn) {
    conditions.push(`LOWER(${qRef(table, config.publicationColumn)}) LIKE ?`);
    params.push(`%${filters.publication.toLowerCase()}%`);
  }

  if (filters.website && config.publicationColumn) {
    conditions.push(`LOWER(${qRef(table, config.publicationColumn)}) LIKE ?`);
    params.push(`%${filters.website.toLowerCase()}%`);
  }

  if (filters.edition && config.editionColumn) {
    conditions.push(`LOWER(${qRef(table, config.editionColumn)}) LIKE ?`);
    params.push(`%${filters.edition.toLowerCase()}%`);
  }

  if (filters.startDate) {
    conditions.push(`${pgDateExpr(config, table)} >= ?::date`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`${pgDateExpr(config, table)} <= ?::date`);
    params.push(filters.endDate);
  }

  if (filters.search) {
    const sanitized = sanitizeSearchQuery(filters.search);
    if (sanitized) {
      const q = toSqlLikePattern(sanitized);
      // Cast to text: some search columns (e.g. authors) are jsonb
      const searchParts = config.searchColumns.map(
        (col) =>
          `LOWER(COALESCE(${qRef(table, col)}::text, '')) LIKE ? ESCAPE '\\'`
      );
      conditions.push(`(${searchParts.join(" OR ")})`);
      params.push(...config.searchColumns.map(() => q));
    }
  }

  return { sql: conditions.join(" AND "), params };
}

export function buildTableConditions(
  config: TableQueryConfig,
  filters: NewsFilters
): SqlParts {
  const { sql: tableWhere, params: tableParams } = buildTableOnlyConditions(
    config,
    filters
  );

  if (isEntityScoped(filters)) {
    return {
      sql: `je.value = ? AND ${tableWhere}`,
      params: [filters.entity!, ...tableParams],
    };
  }

  return { sql: tableWhere, params: tableParams };
}

function shouldDedupeBySource(filters: NewsFilters): boolean {
  return !filters.entity;
}

const DEDUPED_REFS_CTE = `
  deduped_refs AS (
    SELECT media_type, source_table, record_key, entity_category, sort_date
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

async function buildExpandedUnionQuery(filters: NewsFilters): Promise<SqlParts> {
  const configs = await getConfigs(filters.mediaType);

  if (configs.length === 0) {
    return { sql: "SELECT NULL AS media_type WHERE 0", params: [] };
  }

  const subqueries: string[] = [];
  const allParams: unknown[] = [];

  for (const config of configs) {
    const table = config.table;
    const { sql: whereSql, params } = buildTableConditions(config, filters);
    const entityExpr = isEntityScoped(filters)
      ? "je.value"
      : entityCategoryExpr(table);

    subqueries.push(`
      SELECT
        '${config.mediaType}' AS media_type,
        '${table}' AS source_table,
        ${qRef(table, config.idColumn)}::text AS record_key,
        ${entityExpr} AS entity_category,
        ${qRef(table, config.dateColumn)} AS sort_date
      ${buildCategoryFromClause(config, filters)}
      WHERE ${whereSql}
    `);
    allParams.push(...params);
  }

  return {
    sql: subqueries.join(" UNION ALL "),
    params: allParams,
  };
}

async function buildCountQuery(filters: NewsFilters): Promise<SqlParts> {
  const configs = await getConfigs(filters.mediaType);

  if (configs.length === 0) {
    return { sql: "SELECT 0 AS total", params: [] };
  }

  if (shouldDedupeBySource(filters)) {
    if (!isEntityScoped(filters)) {
      const countParts: string[] = [];
      const allParams: unknown[] = [];
      for (const config of configs) {
        const table = config.table;
        const { sql: whereSql, params } = buildTableConditions(config, filters);
        countParts.push(`
          SELECT COUNT(*)::int AS cnt
          FROM ${qTable(table)}
          WHERE ${whereSql}
        `);
        allParams.push(...params);
      }
      return {
        sql: `SELECT COALESCE(SUM(cnt), 0)::int AS total FROM (${countParts.join(" UNION ALL ")}) counts`,
        params: allParams,
      };
    }

    const { sql: unionSql, params } = await buildExpandedUnionQuery(filters);
    return {
      sql: `
        WITH expanded AS (${unionSql}),
        ${DEDUPED_REFS_CTE}
        SELECT COUNT(*)::int AS total FROM deduped_refs
      `,
      params,
    };
  }

  const countParts: string[] = [];
  const allParams: unknown[] = [];

  for (const config of configs) {
    const { sql: whereSql, params } = buildTableConditions(config, filters);
    const fromClause = buildCategoryFromClause(config, filters);

    countParts.push(`
      SELECT COUNT(*)::int AS cnt
      ${fromClause}
      WHERE ${whereSql}
    `);
    allParams.push(...params);
  }

  return {
    sql: `SELECT COALESCE(SUM(cnt), 0)::int AS total FROM (${countParts.join(" UNION ALL ")}) counts`,
    params: allParams,
  };
}

async function buildPageRefsQuery(
  filters: NewsFilters,
  page: number,
  pageSize: number
): Promise<SqlParts> {
  const offset = (page - 1) * pageSize;
  const { sql: unionSql, params } = await buildExpandedUnionQuery(filters);

  if (unionSql.includes("WHERE 0")) {
    return { sql: "SELECT NULL AS media_type WHERE 0", params: [] };
  }

  if (shouldDedupeBySource(filters)) {
    return {
      sql: `
        WITH expanded AS (${unionSql}),
        ${DEDUPED_REFS_CTE}
        SELECT media_type, source_table, record_key, entity_category, sort_date
        FROM deduped_refs
        ORDER BY sort_date::timestamp DESC
        LIMIT ? OFFSET ?
      `,
      params: [...params, pageSize, offset],
    };
  }

  return {
    sql: `
      SELECT media_type, source_table, record_key, entity_category, sort_date
      FROM (${unionSql}) expanded
      ORDER BY sort_date::timestamp DESC
      LIMIT ? OFFSET ?
    `,
    params: [...params, pageSize, offset],
  };
}

function withEpochPublishedAt(record: NewsRecord): NewsRecord {
  if (record.publishedAt === undefined) {
    return record;
  }
  return {
    ...record,
    publishedAt: toEpochMs(record.publishedAt),
  };
}

async function hydrateRecord(
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

function rowToRecord(row: Record<string, unknown>): NewsRecord | null {
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

export interface PaginatedQueryResult {
  data: NewsRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export async function queryRecordsPaginated(
  filters: NewsFilters,
  page = 1,
  pageSize = 20,
  options?: { maxPageSize?: number }
): Promise<PaginatedQueryResult> {
  const safePage = Math.max(1, page);
  const cap = options?.maxPageSize ?? API_MAX_PAGE_SIZE;
  const safePageSize = Math.max(1, Math.min(pageSize, cap));
  const offset = (safePage - 1) * safePageSize;

  const normalizedFilters = filters.search
    ? { ...filters, search: sanitizeSearchQuery(filters.search) }
    : filters;

  const [{ sql: countSql, params: countParams }, configMap] = await Promise.all([
    buildCountQuery(normalizedFilters),
    getConfigs().then(
      (configs) => new Map(configs.map((config) => [config.mediaType, config]))
    ),
  ]);

  if (normalizedFilters.mediaType) {
    const config = configMap.get(normalizedFilters.mediaType);
    if (!config) {
      return { data: [], total: 0, page: safePage, pageSize: safePageSize };
    }

    const table = config.table;
    const { sql: whereSql, params } = buildTableConditions(
      config,
      normalizedFilters
    );
    const entityExpr = isEntityScoped(normalizedFilters)
      ? "je.value"
      : entityCategoryExpr(table);
    const fromClause = buildCategoryFromClause(config, normalizedFilters);
    const sortCol = pgDateTimeExpr(table, config.dateColumn);

    const listSql =
      shouldDedupeBySource(normalizedFilters) &&
      isEntityScoped(normalizedFilters)
        ? `
      SELECT * FROM (
        SELECT
          '${config.mediaType}' AS media_type,
          '${table}' AS source_table,
          ${entityExpr} AS entity_category,
          ${qRef(table, config.dateColumn)} AS sort_date,
          ${qTable(table)}.*,
          ROW_NUMBER() OVER (
            PARTITION BY ${qRef(table, config.idColumn)}::text
            ORDER BY ${sortCol} DESC
          ) AS rn
        ${fromClause}
        WHERE ${whereSql}
      ) ranked
      WHERE rn = 1
      ORDER BY sort_date::timestamp DESC
      LIMIT ? OFFSET ?
    `
        : `
      SELECT
        '${config.mediaType}' AS media_type,
        '${table}' AS source_table,
        ${entityExpr} AS entity_category,
        ${qRef(table, config.dateColumn)} AS sort_date,
        ${qTable(table)}.*
      ${fromClause}
      WHERE ${whereSql}
      ORDER BY ${sortCol} DESC
      LIMIT ? OFFSET ?
    `;

    const [countRow, rows] = await Promise.all([
      queryOne<{ total: number }>(countSql, countParams),
      queryAll<Record<string, unknown>>(listSql, [
        ...params,
        safePageSize,
        offset,
      ]),
    ]);
    const total = countRow?.total ?? 0;
    if (total === 0) {
      return { data: [], total: 0, page: safePage, pageSize: safePageSize };
    }

    const data = rows
      .map((row) => rowToRecord(row))
      .filter((record): record is NewsRecord => record !== null);

    return { data, total, page: safePage, pageSize: safePageSize };
  }

  const pageRefs = await buildPageRefsQuery(
    normalizedFilters,
    safePage,
    safePageSize
  );

  const [countRow, refs] = await Promise.all([
    queryOne<{ total: number }>(countSql, countParams),
    queryAll<PageRefRow>(pageRefs.sql, pageRefs.params),
  ]);
  const total = countRow?.total ?? 0;

  if (total === 0) {
    return { data: [], total: 0, page: safePage, pageSize: safePageSize };
  }

  const data: NewsRecord[] = (
    await Promise.all(
      refs.map(async (ref) => {
        const config = configMap.get(ref.media_type);
        if (!config) return null;
        return hydrateRecord(config, ref.record_key, ref.entity_category);
      })
    )
  ).filter((record): record is NewsRecord => record !== null);

  return { data, total, page: safePage, pageSize: safePageSize };
}

export async function countRecords(filters: NewsFilters): Promise<number> {
  const { sql, params } = await buildCountQuery(filters);
  const row = await queryOne<{ total: number }>(sql, params);
  return row?.total ?? 0;
}

export async function queryRecordsByIds(
  filters: NewsFilters,
  ids: string[]
): Promise<NewsRecord[]> {
  if (ids.length === 0) return [];

  const idSet = new Set(ids);
  const found = new Map<string, NewsRecord>();
  let page = 1;
  const maxPages = Math.ceil(MAX_EXPORT_ROWS / EXPORT_BATCH_SIZE);

  while (found.size < ids.length && page <= maxPages) {
    const batch = await queryRecordsPaginated(filters, page, EXPORT_BATCH_SIZE, {
      maxPageSize: EXPORT_BATCH_SIZE,
    });

    if (batch.data.length === 0) break;

    for (const record of batch.data) {
      if (idSet.has(record.id)) {
        found.set(record.id, record);
      }
    }

    if (page * EXPORT_BATCH_SIZE >= batch.total) break;
    page++;
  }

  return ids
    .map((id) => found.get(id))
    .filter((record): record is NewsRecord => record !== undefined);
}

export interface RecordsBatchCallback {
  (records: NewsRecord[], page: number, total: number): boolean | void;
}

export async function forEachRecordsBatch(
  filters: NewsFilters,
  pageSize: number,
  callback: RecordsBatchCallback
): Promise<number> {
  let page = 1;
  let processed = 0;
  const maxPages = Math.ceil(MAX_EXPORT_ROWS / pageSize);

  while (page <= maxPages) {
    const batch = await queryRecordsPaginated(filters, page, pageSize, {
      maxPageSize: pageSize,
    });

    if (batch.data.length === 0) break;

    const stop = callback(batch.data, page, batch.total);
    processed += batch.data.length;

    if (stop === true) break;
    if (page * pageSize >= batch.total) break;
    page++;
  }

  return processed;
}

// Re-export for analytics/constituency modules
export { buildCategoryFromClause, entityCategoryExpr };
