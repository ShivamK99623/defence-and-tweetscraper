import { createHash } from "crypto";
import { DEFENCE_ENTITIES } from "@/constants";
import type { DefenceEntity, MediaType, NewsFilters, NewsRecord } from "@/types";
import { normalizeRecord } from "./normalizer";
import { mapRowForMediaType, stripQueryMeta } from "./reader-utils";
import { getDatabase, tableExists } from "./db";

const SOURCE_FILE = "database.db";

interface TableQueryConfig {
  table: string;
  mediaType: MediaType;
  dateColumn: string;
  idColumn: string;
  sentimentColumn: string;
  languageColumn: string;
  publicationColumn?: string;
  editionColumn?: string;
  searchColumns: string[];
}

const TABLE_CONFIGS: TableQueryConfig[] = [
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
    dateColumn: "posted_time",
    idColumn: "id",
    sentimentColumn: "sentiment",
    languageColumn: "language",
    searchColumns: ["title_english", "english_summary", "channel_name"],
  },
  {
    table: "twitter_news",
    mediaType: "twitter",
    dateColumn: "posted_time",
    idColumn: "id",
    sentimentColumn: "sentiment",
    languageColumn: "language",
    searchColumns: ["headline", "summary", "handle"],
  },
];

interface SqlParts {
  sql: string;
  params: unknown[];
}

interface PageRef {
  mediaType: MediaType;
  table: string;
  recordKey: string;
  entity: DefenceEntity;
  sortDate: string;
}

function getConfigs(mediaType?: MediaType): TableQueryConfig[] {
  return mediaType
    ? TABLE_CONFIGS.filter((c) => c.mediaType === mediaType)
    : TABLE_CONFIGS;
}

function buildTableConditions(
  config: TableQueryConfig,
  filters: NewsFilters
): SqlParts {
  const table = config.table;
  const conditions: string[] = [
    `je.value IN (${DEFENCE_ENTITIES.map(() => "?").join(", ")})`,
  ];
  const params: unknown[] = [...DEFENCE_ENTITIES];

  if (filters.entity) {
    conditions.push("je.value = ?");
    params.push(filters.entity);
  }

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
    conditions.push(`date(${table}.${config.dateColumn}) >= date(?)`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`date(${table}.${config.dateColumn}) <= date(?)`);
    params.push(filters.endDate);
  }

  if (filters.search) {
    const q = `%${filters.search.toLowerCase()}%`;
    const searchParts = config.searchColumns.map(
      (col) => `LOWER(COALESCE(${table}.${col}, '')) LIKE ?`
    );
    conditions.push(`(${searchParts.join(" OR ")})`);
    params.push(...config.searchColumns.map(() => q));
  }

  return { sql: conditions.join(" AND "), params };
}

function buildCountQuery(filters: NewsFilters): SqlParts {
  const configs = getConfigs(filters.mediaType).filter((c) =>
    tableExists(c.table)
  );

  if (configs.length === 0) {
    return { sql: "SELECT 0 AS total", params: [] };
  }

  const countParts: string[] = [];
  const allParams: unknown[] = [];

  for (const config of configs) {
    const table = config.table;
    const { sql: whereSql, params } = buildTableConditions(config, filters);

    countParts.push(`
      SELECT COUNT(*) AS cnt
      FROM ${table}
      INNER JOIN json_each(${table}.category) AS je
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

    subqueries.push(`
      SELECT
        '${config.mediaType}' AS media_type,
        '${table}' AS source_table,
        CAST(${table}.${config.idColumn} AS TEXT) AS record_key,
        je.value AS entity_category,
        ${table}.${config.dateColumn} AS sort_date
      FROM ${table}
      INNER JOIN json_each(${table}.category) AS je
      WHERE ${whereSql}
    `);
    allParams.push(...params);
  }

  const offset = (page - 1) * pageSize;

  return {
    sql: `
      SELECT media_type, source_table, record_key, entity_category, sort_date
      FROM (${subqueries.join(" UNION ALL ")})
      ORDER BY datetime(sort_date) DESC
      LIMIT ? OFFSET ?
    `,
    params: [...allParams, pageSize, offset],
  };
}

function getRowSourceId(
  row: Record<string, unknown>,
  mediaType: MediaType
): string {
  if (mediaType === "print" || mediaType === "online") {
    return String(row.newsId ?? "");
  }
  return String(row.id ?? "");
}

function hydrateRecord(
  config: TableQueryConfig,
  recordKey: string,
  entity: DefenceEntity
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
  const entity = row.entity_category as DefenceEntity;
  const mediaType = row.media_type as MediaType;
  const table = row.source_table as string;

  if (!entity || !mediaType || !table) return null;
  if (!DEFENCE_ENTITIES.includes(entity)) return null;

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
  pageSize = 20
): PaginatedQueryResult {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(pageSize, 100));
  const database = getDatabase();

  const { sql: countSql, params: countParams } = buildCountQuery(filters);
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
  if (filters.mediaType) {
    const config = configMap.get(filters.mediaType);
    if (!config) {
      return { data: [], total: 0, page: safePage, pageSize: safePageSize };
    }

    const table = config.table;
    const { sql: whereSql, params } = buildTableConditions(config, filters);
    const offset = (safePage - 1) * safePageSize;

    const sql = `
      SELECT
        '${config.mediaType}' AS media_type,
        '${table}' AS source_table,
        je.value AS entity_category,
        ${table}.${config.dateColumn} AS sort_date,
        ${table}.*
      FROM ${table}
      INNER JOIN json_each(${table}.category) AS je
      WHERE ${whereSql}
      ORDER BY datetime(${table}.${config.dateColumn}) DESC
      LIMIT ? OFFSET ?
    `;

    const rows = database
      .prepare(sql)
      .all(...params, safePageSize, offset) as Record<string, unknown>[];

    const data = rows
      .map((row) => rowToRecord(row))
      .filter((record): record is NewsRecord => record !== null);

    return { data, total, page: safePage, pageSize: safePageSize };
  }

  // Multi-table: page refs then hydrate
  const { sql, params } = buildPageRefsQuery(filters, safePage, safePageSize);
  const refs = database.prepare(sql).all(...params) as PageRef[];

  const data: NewsRecord[] = [];

  for (const ref of refs) {
    const config = configMap.get(ref.mediaType);
    if (!config) continue;

    const record = hydrateRecord(config, ref.recordKey, ref.entity);
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
