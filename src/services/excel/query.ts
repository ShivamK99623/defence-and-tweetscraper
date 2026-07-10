import { createHash } from "crypto";
import { sanitizeSearchQuery, toSqlLikePattern } from "@/lib/search";
import type { MediaType, NewsFilters, NewsRecord } from "@/types";
import { normalizeRecord } from "./normalizer";
import { mapRowForMediaType, stripQueryMeta, getRowSourceKey } from "./reader-utils";
import { getDatabase, tableExists } from "./db";

const SOURCE_FILE = "database.db";

export const EXPORT_BATCH_SIZE = 500;
export const MAX_EXPORT_ROWS = 50_000;
export const API_MAX_PAGE_SIZE = 100;

export interface TableQueryConfig {
  table: string;
  mediaType: MediaType;
  dateColumn: string;
  /** When true, dateColumn is UTC wall-clock — compare filters in IST. */
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
    searchColumns: [
      "heading",
      "summary",
      "content",
      "publicationName",
      "authors",
    ],
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
    searchColumns: [
      "heading",
      "summary",
      "content",
      "publicationName",
      "authors",
    ],
  },
  {
    table: "youtube_news",
    mediaType: "youtube",
    dateColumn: "postedTime",
    dateStoredAsUtc: true,
    idColumn: "youtubeId",
    sentimentColumn: "sentiment",
    languageColumn: "language",
    searchColumns: ["title_english", "english_summary", "channel_name"],
  },
  {
    table: "twitter_news",
    mediaType: "twitter",
    dateColumn: "postedTime",
    dateStoredAsUtc: true,
    idColumn: "newsId",
    sentimentColumn: "sentiment",
    languageColumn: "language",
    searchColumns: ["headline", "summary", "handle"],
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
  sort_date: string;
}

export function getConfigs(mediaType?: MediaType): TableQueryConfig[] {
  return mediaType
    ? TABLE_CONFIGS.filter((c) => c.mediaType === mediaType)
    : TABLE_CONFIGS;
}

export function sqlDateExpr(config: TableQueryConfig, table: string): string {
  const col = `${table}.${config.dateColumn}`;
  if (config.dateStoredAsUtc) {
    return `date(datetime(${col}, '+5 hours', '+30 minutes'))`;
  }
  return `date(${col})`;
}

/** Entity pages filter `category`; overview includes every row in the media tables. */
export function isEntityScoped(filters: NewsFilters): boolean {
  return Boolean(filters.entity);
}

export function entityCategoryExpr(table: string): string {
  return `COALESCE(
    (SELECT je.value FROM json_each(${table}.category) AS je LIMIT 1),
    'Uncategorized'
  )`;
}

export function buildTableOnlyConditions(
  config: TableQueryConfig,
  filters: NewsFilters
): SqlParts {
  const table = config.table;
  const conditions: string[] = ["1 = 1"];
  const params: unknown[] = [];

  if (filters.sentiment) {
    conditions.push(`LOWER(${table}.${config.sentimentColumn}) LIKE ?`);
    params.push(`%${filters.sentiment.toLowerCase()}%`);
  }

  if (filters.language) {
    conditions.push(`LOWER(${table}.${config.languageColumn}) = ?`);
    params.push(filters.language.toLowerCase());
  }

  if (filters.publication && config.publicationColumn) {
    conditions.push(`LOWER(${table}.${config.publicationColumn}) LIKE ?`);
    params.push(`%${filters.publication.toLowerCase()}%`);
  }

  if (filters.website && config.publicationColumn) {
    conditions.push(`LOWER(${table}.${config.publicationColumn}) LIKE ?`);
    params.push(`%${filters.website.toLowerCase()}%`);
  }

  if (filters.edition && config.editionColumn) {
    conditions.push(`LOWER(${table}.${config.editionColumn}) LIKE ?`);
    params.push(`%${filters.edition.toLowerCase()}%`);
  }

  if (filters.startDate) {
    conditions.push(`${sqlDateExpr(config, table)} >= date(?)`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`${sqlDateExpr(config, table)} <= date(?)`);
    params.push(filters.endDate);
  }

  if (filters.search) {
    const sanitized = sanitizeSearchQuery(filters.search);
    if (sanitized) {
      const q = toSqlLikePattern(sanitized);
      const searchParts = config.searchColumns.map(
        (col) => `LOWER(COALESCE(${table}.${col}, '')) LIKE ? ESCAPE '\\'`
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
  const table = config.table;
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

export function buildCategoryFromClause(
  config: TableQueryConfig,
  filters: NewsFilters
): string {
  const table = config.table;
  if (isEntityScoped(filters)) {
    return `FROM ${table} INNER JOIN json_each(${table}.category) AS je`;
  }
  return `FROM ${table}`;
}

/** Overview / global search counts dedupe by source; entity pages count per entity row. */
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
          ORDER BY datetime(sort_date) DESC
        ) AS rn
      FROM expanded
    )
    WHERE rn = 1
  )
`;

function buildExpandedUnionQuery(filters: NewsFilters): SqlParts {
  const configs = getConfigs(filters.mediaType).filter((c) =>
    tableExists(c.table)
  );

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
        CAST(${table}.${config.idColumn} AS TEXT) AS record_key,
        ${entityExpr} AS entity_category,
        ${table}.${config.dateColumn} AS sort_date
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

function buildCountQuery(filters: NewsFilters): SqlParts {
  const configs = getConfigs(filters.mediaType).filter((c) =>
    tableExists(c.table)
  );

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
          SELECT COUNT(*) AS cnt
          FROM ${table}
          WHERE ${whereSql}
        `);
        allParams.push(...params);
      }
      return {
        sql: `SELECT COALESCE(SUM(cnt), 0) AS total FROM (${countParts.join(" UNION ALL ")})`,
        params: allParams,
      };
    }

    const { sql: unionSql, params } = buildExpandedUnionQuery(filters);
    return {
      sql: `
        WITH expanded AS (${unionSql}),
        ${DEDUPED_REFS_CTE}
        SELECT COUNT(*) AS total FROM deduped_refs
      `,
      params,
    };
  }

  const countParts: string[] = [];
  const allParams: unknown[] = [];

  for (const config of configs) {
    const table = config.table;
    const { sql: whereSql, params } = buildTableConditions(config, filters);
    const fromClause = buildCategoryFromClause(config, filters);

    countParts.push(`
      SELECT COUNT(*) AS cnt
      ${fromClause}
      WHERE ${whereSql}
    `);
    allParams.push(...params);
  }

  return {
    sql: `SELECT COALESCE(SUM(cnt), 0) AS total FROM (${countParts.join(" UNION ALL ")})`,
    params: allParams,
  };
}

function buildPageRefsQuery(
  filters: NewsFilters,
  page: number,
  pageSize: number
): SqlParts {
  const offset = (page - 1) * pageSize;
  const { sql: unionSql, params } = buildExpandedUnionQuery(filters);

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
        ORDER BY datetime(sort_date) DESC
        LIMIT ? OFFSET ?
      `,
      params: [...params, pageSize, offset],
    };
  }

  return {
    sql: `
      SELECT media_type, source_table, record_key, entity_category, sort_date
      FROM (${unionSql})
      ORDER BY datetime(sort_date) DESC
      LIMIT ? OFFSET ?
    `,
    params: [...params, pageSize, offset],
  };
}

function getRowSourceId(
  row: Record<string, unknown>,
  mediaType: MediaType
): string {
  return getRowSourceKey(row, mediaType);
}

function hydrateRecord(
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
  const sourceId = getRowSourceId(mapped, config.mediaType);

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

function rowToRecord(row: Record<string, unknown>): NewsRecord | null {
  const entity = row.entity_category as string;
  const mediaType = row.media_type as MediaType;
  const table = row.source_table as string;

  if (!entity || !mediaType || !table) return null;

  const cleaned = stripQueryMeta(row);
  const mapped = mapRowForMediaType(cleaned, mediaType);
  const columns = Object.keys(mapped);
  const sourceId = getRowSourceId(mapped, mediaType);

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

  return { ...normalized, id };
}

export interface PaginatedQueryResult {
  data: NewsRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export function queryRecordsPaginated(
  filters: NewsFilters,
  page = 1,
  pageSize = 20,
  options?: { maxPageSize?: number }
): PaginatedQueryResult {
  const safePage = Math.max(1, page);
  const cap = options?.maxPageSize ?? API_MAX_PAGE_SIZE;
  const safePageSize = Math.max(1, Math.min(pageSize, cap));
  const database = getDatabase();

  const normalizedFilters = filters.search
    ? { ...filters, search: sanitizeSearchQuery(filters.search) }
    : filters;

  const { sql: countSql, params: countParams } = buildCountQuery(normalizedFilters);
  const countRow = database.prepare(countSql).get(...countParams) as {
    total: number;
  };
  const total = countRow?.total ?? 0;

  if (total === 0) {
    return { data: [], total: 0, page: safePage, pageSize: safePageSize };
  }

  const configMap = new Map(
    TABLE_CONFIGS.filter((c) => tableExists(c.table)).map((c) => [c.mediaType, c])
  );

  // Single-table fast path: fetch rows directly with JOIN
  if (normalizedFilters.mediaType) {
    const config = configMap.get(normalizedFilters.mediaType);
    if (!config) {
      return { data: [], total: 0, page: safePage, pageSize: safePageSize };
    }

    const table = config.table;
    const { sql: whereSql, params } = buildTableConditions(config, normalizedFilters);
    const offset = (safePage - 1) * safePageSize;
    const entityExpr = isEntityScoped(normalizedFilters)
      ? "je.value"
      : entityCategoryExpr(table);
    const fromClause = buildCategoryFromClause(config, normalizedFilters);

    const listSql =
      shouldDedupeBySource(normalizedFilters) && isEntityScoped(normalizedFilters)
        ? `
      SELECT * FROM (
        SELECT
          '${config.mediaType}' AS media_type,
          '${table}' AS source_table,
          ${entityExpr} AS entity_category,
          ${table}.${config.dateColumn} AS sort_date,
          ${table}.*,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(${table}.${config.idColumn} AS TEXT)
            ORDER BY datetime(${table}.${config.dateColumn}) DESC
          ) AS rn
        ${fromClause}
        WHERE ${whereSql}
      )
      WHERE rn = 1
      ORDER BY datetime(sort_date) DESC
      LIMIT ? OFFSET ?
    `
        : `
      SELECT
        '${config.mediaType}' AS media_type,
        '${table}' AS source_table,
        ${entityExpr} AS entity_category,
        ${table}.${config.dateColumn} AS sort_date,
        ${table}.*
      ${fromClause}
      WHERE ${whereSql}
      ORDER BY datetime(${table}.${config.dateColumn}) DESC
      LIMIT ? OFFSET ?
    `;

    const rows = database
      .prepare(listSql)
      .all(...params, safePageSize, offset) as Record<string, unknown>[];

    const data = rows
      .map((row) => rowToRecord(row))
      .filter((record): record is NewsRecord => record !== null);

    return { data, total, page: safePage, pageSize: safePageSize };
  }

  // Multi-table: page refs then hydrate
  const { sql, params } = buildPageRefsQuery(
    normalizedFilters,
    safePage,
    safePageSize
  );
  const refs = database.prepare(sql).all(...params) as PageRefRow[];

  const data: NewsRecord[] = [];

  for (const ref of refs) {
    const config = configMap.get(ref.media_type);
    if (!config) continue;

    const record = hydrateRecord(
      config,
      ref.record_key,
      ref.entity_category
    );
    if (record) data.push(record);
  }

  return { data, total, page: safePage, pageSize: safePageSize };
}

export function countRecords(filters: NewsFilters): number {
  const database = getDatabase();
  const { sql, params } = buildCountQuery(filters);
  const row = database.prepare(sql).get(...params) as { total: number };
  return row?.total ?? 0;
}

/** Fetch specific records by id using paginated SQL scans (for small selected sets). */
export function queryRecordsByIds(
  filters: NewsFilters,
  ids: string[]
): NewsRecord[] {
  if (ids.length === 0) return [];

  const idSet = new Set(ids);
  const found = new Map<string, NewsRecord>();
  let page = 1;
  const maxPages = Math.ceil(MAX_EXPORT_ROWS / EXPORT_BATCH_SIZE);

  while (found.size < ids.length && page <= maxPages) {
    const batch = queryRecordsPaginated(filters, page, EXPORT_BATCH_SIZE, {
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

/**
 * Walk matching records in SQL pages without loading the full dataset into memory.
 * Return true from the callback to stop early.
 */
export function forEachRecordsBatch(
  filters: NewsFilters,
  pageSize: number,
  callback: RecordsBatchCallback
): number {
  let page = 1;
  let processed = 0;
  const maxPages = Math.ceil(MAX_EXPORT_ROWS / pageSize);

  while (page <= maxPages) {
    const batch = queryRecordsPaginated(filters, page, pageSize, {
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
