import { createHash } from "crypto";
import { DEFENCE_ENTITIES, MEDIA_TYPES } from "@/constants";
import { sanitizeSearchQuery } from "@/lib/search";
import { pgDateExpr, qRef } from "@/lib/db/pg-sql";
import { queryAll, queryOne } from "@/lib/db/run-query";
import { toEpochMs } from "@/lib/db/timestamps";
import type {
  DefenceEntity,
  EntityAnalytics,
  MediaType,
  NewsFilters,
  OverviewAnalytics,
  TopNewsItem,
} from "@/types";
import {
  buildTableConditions,
  buildCategoryFromClause,
  entityCategoryExpr,
  isEntityScoped,
  getConfigs,
  type TableQueryConfig,
} from "./query";

interface ExpandedRow {
  media_type: MediaType;
  source_id: string;
  source_table: string;
  entity: DefenceEntity;
  sentiment: string;
  published_at: string | Date;
  calendar_date: string | null;
  heading: string;
  edition: string;
  publication: string;
  website: string;
  engagement: number;
  url: string;
  tw_likes: number;
  tw_retweets: number;
  tw_replies: number;
  tw_quotes: number;
  tw_views: number;
  tw_bookmarks: number;
  yt_likes: number;
  yt_comments: number;
  yt_views: number;
}

function headingColumn(config: TableQueryConfig): string {
  if (config.mediaType === "youtube") return "title_english";
  if (config.mediaType === "twitter") return "headline";
  return "heading";
}

function urlExpression(config: TableQueryConfig, table: string): string {
  if (config.mediaType === "twitter") {
    return `TRIM(COALESCE(${qRef(table, "url")}, ''))`;
  }
  if (config.mediaType === "youtube") {
    return `TRIM(COALESCE(${qRef(table, "youtube_url")}, ''))`;
  }
  return "''";
}

function engagementExpression(config: TableQueryConfig, table: string): string {
  if (config.mediaType === "twitter") {
    return `(
      COALESCE(${qRef(table, "likes")}, 0) +
      COALESCE(${qRef(table, "retweets")}, 0) +
      COALESCE(${qRef(table, "replies")}, 0) +
      COALESCE(${qRef(table, "viewCount")}, 0)
    )`;
  }
  if (config.mediaType === "youtube") {
    return `(
      COALESCE(${qRef(table, "comment_count")}, 0) +
      COALESCE(${qRef(table, "like_count")}, 0)
    )`;
  }
  return "0";
}

function metricColumn(
  config: TableQueryConfig,
  table: string,
  column: string,
  fallback = "0"
): string {
  if (config.mediaType !== "twitter") return fallback;
  return `COALESCE(${qRef(table, column)}, 0)`;
}

function youtubeMetricColumn(
  config: TableQueryConfig,
  table: string,
  column: string,
  fallback = "0"
): string {
  if (config.mediaType !== "youtube") return fallback;
  return `COALESCE(${qRef(table, column)}, 0)`;
}

type ExpandedSelectMode = "full" | "lite" | "topNews";

function buildExpandedSelect(
  config: TableQueryConfig,
  filters: NewsFilters,
  mode: ExpandedSelectMode = "full"
): { sql: string; params: unknown[] } {
  const table = config.table;
  const { sql: whereSql, params } = buildTableConditions(config, filters);
  const heading = headingColumn(config);
  const entitySelect = isEntityScoped(filters)
    ? "je.value"
    : entityCategoryExpr(table);
  const edition = config.editionColumn
    ? `TRIM(COALESCE(${qRef(table, config.editionColumn)}, ''))`
    : "''";
  const publication = config.publicationColumn
    ? `TRIM(COALESCE(${qRef(table, config.publicationColumn)}, ''))`
    : "''";
  const website =
    config.mediaType === "online"
      ? publication
      : config.publicationColumn
        ? `TRIM(COALESCE(${qRef(table, config.publicationColumn)}, ''))`
        : "''";

  if (mode === "lite") {
    const sql = `
      SELECT
        '${config.mediaType}' AS media_type,
        ${qRef(table, config.idColumn)}::text AS source_id,
        ${entitySelect} AS entity,
        LOWER(TRIM(COALESCE(${qRef(table, config.sentimentColumn)}, ''))) AS sentiment,
        ${qRef(table, config.dateColumn)} AS published_at,
        ${pgDateExpr(config, table)} AS calendar_date,
        ${edition} AS edition,
        ${publication} AS publication,
        ${website} AS website
      ${buildCategoryFromClause(config, filters)}
      WHERE ${whereSql}
    `;
    return { sql, params };
  }

  if (mode === "topNews") {
    const sql = `
      SELECT
        '${config.mediaType}' AS media_type,
        ${qRef(table, config.idColumn)}::text AS source_id,
        '${table}' AS source_table,
        ${entitySelect} AS entity,
        LOWER(TRIM(COALESCE(${qRef(table, config.sentimentColumn)}, ''))) AS sentiment,
        ${qRef(table, config.dateColumn)} AS published_at,
        TRIM(COALESCE(${qRef(table, heading)}, '')) AS heading,
        ${engagementExpression(config, table)} AS engagement,
        ${urlExpression(config, table)} AS url
      ${buildCategoryFromClause(config, filters)}
      WHERE ${whereSql}
    `;
    return { sql, params };
  }

  const sql = `
    SELECT
      '${config.mediaType}' AS media_type,
      ${qRef(table, config.idColumn)}::text AS source_id,
      '${table}' AS source_table,
      ${entitySelect} AS entity,
      LOWER(TRIM(COALESCE(${qRef(table, config.sentimentColumn)}, ''))) AS sentiment,
      ${qRef(table, config.dateColumn)} AS published_at,
      ${pgDateExpr(config, table)} AS calendar_date,
      TRIM(COALESCE(${qRef(table, heading)}, '')) AS heading,
      ${edition} AS edition,
      ${publication} AS publication,
      ${website} AS website,
      ${engagementExpression(config, table)} AS engagement,
      ${urlExpression(config, table)} AS url,
      ${metricColumn(config, table, "likes")} AS tw_likes,
      ${metricColumn(config, table, "retweets")} AS tw_retweets,
      ${metricColumn(config, table, "replies")} AS tw_replies,
      ${metricColumn(config, table, "quotes")} AS tw_quotes,
      ${metricColumn(config, table, "viewCount")} AS tw_views,
      ${metricColumn(config, table, "bookmarkCount")} AS tw_bookmarks,
      ${youtubeMetricColumn(config, table, "like_count")} AS yt_likes,
      ${youtubeMetricColumn(config, table, "comment_count")} AS yt_comments,
      0 AS yt_views
    ${buildCategoryFromClause(config, filters)}
    WHERE ${whereSql}
  `;

  return { sql, params };
}

function normalizeFilters(filters: NewsFilters): NewsFilters {
  return filters.search
    ? { ...filters, search: sanitizeSearchQuery(filters.search) }
    : filters;
}

interface BuildExpandedOptions {
  mode?: ExpandedSelectMode;
  mediaTypes?: MediaType[];
  /** Force Postgres to compute the CTE once when referenced multiple times. */
  materialized?: boolean;
}

async function buildExpandedCte(
  filters: NewsFilters,
  options: BuildExpandedOptions = {}
): Promise<{ cte: string; params: unknown[] }> {
  const normalizedFilters = normalizeFilters(filters);
  const mode = options.mode ?? "full";
  let configs = await getConfigs(normalizedFilters.mediaType);
  if (options.mediaTypes?.length) {
    const allowed = new Set(options.mediaTypes);
    configs = configs.filter((c) => allowed.has(c.mediaType));
  }

  const parts: string[] = [];
  const params: unknown[] = [];

  for (const config of configs) {
    const { sql, params: partParams } = buildExpandedSelect(
      config,
      normalizedFilters,
      mode
    );
    parts.push(sql);
    params.push(...partParams);
  }

  const materialized = options.materialized ? " MATERIALIZED" : "";

  if (parts.length === 0) {
    if (mode === "lite") {
      return {
        cte: `
          expanded AS${materialized} (
            SELECT
              NULL::text AS media_type, NULL::text AS source_id,
              NULL::text AS entity, NULL::text AS sentiment,
              NULL::timestamptz AS published_at, NULL::date AS calendar_date,
              NULL::text AS edition, NULL::text AS publication, NULL::text AS website
            WHERE 0
          )
        `,
        params: [],
      };
    }
    if (mode === "topNews") {
      return {
        cte: `
          expanded AS${materialized} (
            SELECT
              NULL::text AS media_type, NULL::text AS source_id,
              NULL::text AS source_table, NULL::text AS entity,
              NULL::text AS sentiment, NULL::timestamptz AS published_at,
              NULL::text AS heading, 0::float AS engagement, NULL::text AS url
            WHERE 0
          )
        `,
        params: [],
      };
    }
    return {
      cte: `
        expanded AS${materialized} (
          SELECT
            NULL AS media_type, NULL AS source_id, NULL AS source_table,
            NULL AS entity, NULL AS sentiment, NULL AS published_at,
            NULL AS calendar_date, NULL AS heading, NULL AS edition,
            NULL AS publication, NULL AS website, 0 AS engagement, NULL AS url,
            0 AS tw_likes, 0 AS tw_retweets, 0 AS tw_replies, 0 AS tw_quotes,
            0 AS tw_views, 0 AS tw_bookmarks, 0 AS yt_likes, 0 AS yt_comments,
            0 AS yt_views
          WHERE 0
        )
      `,
      params: [],
    };
  }

  return {
    cte: `expanded AS${materialized} (${parts.join(" UNION ALL ")})`,
    params,
  };
}

const DEDUPED_CTE = `
  deduped AS MATERIALIZED (
    SELECT * FROM (
      SELECT
        expanded.*,
        ROW_NUMBER() OVER (
          PARTITION BY media_type, source_id
          ORDER BY published_at::timestamp DESC
        ) AS rn
      FROM expanded
    ) ranked
    WHERE rn = 1
  )
`;

function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}

function toTopNewsItem(row: ExpandedRow): TopNewsItem {
  const id = createHash("md5")
    .update(`${row.source_table}:${row.source_id}:${row.entity}`)
    .digest("hex");

  return {
    id,
    heading: row.heading,
    sentiment: row.sentiment || "unknown",
    mediaType: row.media_type,
    engagement: row.engagement,
    url: row.url || undefined,
    publishedAt: row.published_at ? toEpochMs(row.published_at) : undefined,
  };
}

async function queryTopMinisterNews(
  filters: NewsFilters,
  sentiment: "positive" | "negative"
): Promise<TopNewsItem[]> {
  // Only scan social tables — print/online are excluded by the WHERE anyway
  const { cte, params } = await buildExpandedCte(filters, {
    mode: "topNews",
    mediaTypes: ["twitter", "youtube"],
  });
  const sql = `
    WITH ${cte},
    deduped AS (
      SELECT * FROM (
        SELECT
          expanded.*,
          ROW_NUMBER() OVER (
            PARTITION BY media_type, source_id
            ORDER BY published_at::timestamp DESC
          ) AS rn
        FROM expanded
      ) ranked
      WHERE rn = 1
    )
    SELECT *
    FROM deduped
    WHERE entity = 'Defence Minister'
      AND heading != ''
      AND sentiment = ?
    ORDER BY engagement DESC
    LIMIT 10
  `;

  const rows = await queryAll<ExpandedRow>(sql, [...params, sentiment]);
  return rows.map(toTopNewsItem);
}

export async function queryOverviewAnalytics(
  filters: NewsFilters
): Promise<OverviewAnalytics> {
  const { cte, params } = await buildExpandedCte(filters, {
    mode: "lite",
    materialized: true,
  });

  // One round-trip: CTE computed once, all aggregates derived from it
  const [bundle, topPositiveNews, topNegativeNews] = await Promise.all([
    queryOne<{
      total: number;
      positive: number;
      negative: number;
      neutral: number;
      print: number;
      online: number;
      twitter: number;
      youtube: number;
      entities: { entity: string; count: number }[] | null;
      trends: {
        date: string;
        print: number;
        online: number;
        twitter: number;
        youtube: number;
      }[] | null;
      editions: { edition: string; count: number }[] | null;
      websites: { website: string; count: number }[] | null;
    }>(
      `
        WITH ${cte},
        ${DEDUPED_CTE},
        kpi AS (
          SELECT
            COUNT(*)::int AS total,
            SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END)::int AS positive,
            SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END)::int AS negative,
            SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END)::int AS neutral,
            SUM(CASE WHEN media_type = 'print' THEN 1 ELSE 0 END)::int AS print,
            SUM(CASE WHEN media_type = 'online' THEN 1 ELSE 0 END)::int AS online,
            SUM(CASE WHEN media_type = 'twitter' THEN 1 ELSE 0 END)::int AS twitter,
            SUM(CASE WHEN media_type = 'youtube' THEN 1 ELSE 0 END)::int AS youtube
          FROM deduped
        ),
        entity_counts AS (
          SELECT entity, COUNT(*)::int AS count
          FROM expanded
          GROUP BY entity
        ),
        trend_counts AS (
          SELECT
            calendar_date::text AS date,
            SUM(CASE WHEN media_type = 'print' THEN 1 ELSE 0 END)::int AS print,
            SUM(CASE WHEN media_type = 'online' THEN 1 ELSE 0 END)::int AS online,
            SUM(CASE WHEN media_type = 'twitter' THEN 1 ELSE 0 END)::int AS twitter,
            SUM(CASE WHEN media_type = 'youtube' THEN 1 ELSE 0 END)::int AS youtube
          FROM deduped
          WHERE calendar_date IS NOT NULL
            AND EXTRACT(YEAR FROM calendar_date) BETWEEN 2000 AND 2035
          GROUP BY calendar_date
        ),
        edition_counts AS (
          SELECT edition, COUNT(*)::int AS count
          FROM deduped
          WHERE edition != ''
          GROUP BY edition
          ORDER BY count DESC
          LIMIT 10
        ),
        website_counts AS (
          SELECT COALESCE(NULLIF(website, ''), publication) AS website, COUNT(*)::int AS count
          FROM deduped
          WHERE media_type = 'online'
            AND COALESCE(NULLIF(website, ''), publication) != ''
          GROUP BY COALESCE(NULLIF(website, ''), publication)
          ORDER BY count DESC
          LIMIT 10
        )
        SELECT
          kpi.*,
          (SELECT COALESCE(jsonb_agg(to_jsonb(ec) ORDER BY ec.count DESC), '[]'::jsonb)
             FROM entity_counts ec) AS entities,
          (SELECT COALESCE(jsonb_agg(to_jsonb(tc) ORDER BY tc.date), '[]'::jsonb)
             FROM trend_counts tc) AS trends,
          (SELECT COALESCE(jsonb_agg(to_jsonb(ed) ORDER BY ed.count DESC), '[]'::jsonb)
             FROM edition_counts ed) AS editions,
          (SELECT COALESCE(jsonb_agg(to_jsonb(wc) ORDER BY wc.count DESC), '[]'::jsonb)
             FROM website_counts wc) AS websites
        FROM kpi
      `,
      params
    ),
    queryTopMinisterNews(filters, "positive"),
    queryTopMinisterNews(filters, "negative"),
  ]);

  const total = bundle?.total ?? 0;
  const positive = bundle?.positive ?? 0;
  const negative = bundle?.negative ?? 0;
  const neutral = bundle?.neutral ?? 0;

  const entityRows = bundle?.entities ?? [];
  const entityCountMap = new Map(
    entityRows.map((row) => [row.entity, row.count])
  );

  const defenceEntityDistribution = DEFENCE_ENTITIES.map((entity) => ({
    entity,
    count: entityCountMap.get(entity) ?? 0,
  }));

  const otherEntityDistribution = entityRows
    .filter((row) => !DEFENCE_ENTITIES.includes(row.entity as DefenceEntity))
    .map((row) => ({
      entity: row.entity,
      count: row.count,
    }));

  const entityDistribution = [
    ...defenceEntityDistribution,
    ...otherEntityDistribution,
  ].filter((row) => row.count > 0);

  const trendRows = bundle?.trends ?? [];

  return {
    kpis: {
      total,
      positive,
      negative,
      neutral,
      print: bundle?.print ?? 0,
      online: bundle?.online ?? 0,
      twitter: bundle?.twitter ?? 0,
      youtube: bundle?.youtube ?? 0,
      positivePercent: pct(positive, total),
      negativePercent: pct(negative, total),
      neutralPercent: pct(neutral, total),
    },
    entityDistribution,
    mediaDistribution: MEDIA_TYPES.map((mediaType) => ({
      mediaType,
      count:
        mediaType === "print"
          ? (bundle?.print ?? 0)
          : mediaType === "online"
            ? (bundle?.online ?? 0)
            : mediaType === "twitter"
              ? (bundle?.twitter ?? 0)
              : (bundle?.youtube ?? 0),
    })),
    topPositiveNews,
    topNegativeNews,
    dailyTrend: trendRows.map((row) => ({
      date: row.date,
      print: row.print,
      online: row.online,
      twitter: row.twitter,
      youtube: row.youtube,
      total: row.print + row.online + row.twitter + row.youtube,
    })),
    topEditions: bundle?.editions ?? [],
    topOnlineSources: bundle?.websites ?? [],
    lastUpdated: Date.now(),
  };
}

export async function queryEntityAnalytics(
  filters: NewsFilters,
  entity: DefenceEntity
): Promise<EntityAnalytics> {
  const entityFilters = { ...filters, entity };
  const { cte, params } = await buildExpandedCte(entityFilters, {
    materialized: true,
  });

  const bundle = await queryOne<{
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    media: { media_type: MediaType; count: number }[] | null;
    sentiments: {
      media_type: MediaType;
      sentiment: string;
      count: number;
    }[] | null;
    tw_likes: number | null;
    tw_retweets: number | null;
    tw_replies: number | null;
    tw_quotes: number | null;
    tw_views: number | null;
    tw_bookmarks: number | null;
    yt_likes: number | null;
    yt_comments: number | null;
    yt_views: number | null;
    publications: { publication: string; count: number }[] | null;
    editions: { edition: string; count: number }[] | null;
    websites: { website: string; count: number }[] | null;
  }>(
    `
      WITH ${cte},
      kpi AS (
        SELECT
          COUNT(*)::int AS total,
          SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END)::int AS positive,
          SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END)::int AS negative,
          SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END)::int AS neutral
        FROM expanded
      ),
      media_counts AS (
        SELECT media_type, COUNT(*)::int AS count
        FROM expanded
        GROUP BY media_type
      ),
      sentiment_counts AS (
        SELECT media_type, sentiment, COUNT(*)::int AS count
        FROM expanded
        GROUP BY media_type, sentiment
      ),
      twitter_eng AS (
        SELECT
          SUM(tw_likes)::int AS likes,
          SUM(tw_retweets)::int AS retweets,
          SUM(tw_replies)::int AS replies,
          SUM(tw_quotes)::int AS quotes,
          SUM(tw_views)::int AS views,
          SUM(tw_bookmarks)::int AS bookmarks
        FROM expanded
        WHERE media_type = 'twitter'
      ),
      youtube_eng AS (
        SELECT
          SUM(yt_likes)::int AS likes,
          SUM(yt_comments)::int AS comments,
          SUM(yt_views)::int AS views
        FROM expanded
        WHERE media_type = 'youtube'
      ),
      publication_counts AS (
        SELECT publication, COUNT(*)::int AS count
        FROM expanded
        WHERE media_type = 'print' AND publication != ''
        GROUP BY publication
        ORDER BY count DESC
        LIMIT 10
      ),
      edition_counts AS (
        SELECT edition, COUNT(*)::int AS count
        FROM expanded
        WHERE media_type = 'print' AND edition != ''
        GROUP BY edition
        ORDER BY count DESC
        LIMIT 10
      ),
      website_counts AS (
        SELECT COALESCE(NULLIF(website, ''), publication) AS website, COUNT(*)::int AS count
        FROM expanded
        WHERE media_type = 'online'
          AND COALESCE(NULLIF(website, ''), publication) != ''
        GROUP BY COALESCE(NULLIF(website, ''), publication)
        ORDER BY count DESC
        LIMIT 10
      )
      SELECT
        kpi.*,
        (SELECT COALESCE(jsonb_agg(to_jsonb(mc)), '[]'::jsonb) FROM media_counts mc) AS media,
        (SELECT COALESCE(jsonb_agg(to_jsonb(sc)), '[]'::jsonb) FROM sentiment_counts sc) AS sentiments,
        (SELECT likes FROM twitter_eng) AS tw_likes,
        (SELECT retweets FROM twitter_eng) AS tw_retweets,
        (SELECT replies FROM twitter_eng) AS tw_replies,
        (SELECT quotes FROM twitter_eng) AS tw_quotes,
        (SELECT views FROM twitter_eng) AS tw_views,
        (SELECT bookmarks FROM twitter_eng) AS tw_bookmarks,
        (SELECT likes FROM youtube_eng) AS yt_likes,
        (SELECT comments FROM youtube_eng) AS yt_comments,
        (SELECT views FROM youtube_eng) AS yt_views,
        (SELECT COALESCE(jsonb_agg(to_jsonb(pc)), '[]'::jsonb) FROM publication_counts pc) AS publications,
        (SELECT COALESCE(jsonb_agg(to_jsonb(ed)), '[]'::jsonb) FROM edition_counts ed) AS editions,
        (SELECT COALESCE(jsonb_agg(to_jsonb(wc)), '[]'::jsonb) FROM website_counts wc) AS websites
      FROM kpi
    `,
    params
  );

  const mediaRows = bundle?.media ?? [];
  const mediaCountMap = new Map(
    mediaRows.map((row) => [row.media_type, row.count])
  );
  const sentimentRows = bundle?.sentiments ?? [];

  const mediaSentimentBreakdown = MEDIA_TYPES.map((mediaType) => {
    const rows = sentimentRows.filter((row) => row.media_type === mediaType);
    return {
      mediaType,
      positive: rows.find((row) => row.sentiment === "positive")?.count ?? 0,
      negative: rows.find((row) => row.sentiment === "negative")?.count ?? 0,
      neutral: rows.find((row) => row.sentiment === "neutral")?.count ?? 0,
    };
  });

  const twitterCount = mediaCountMap.get("twitter") ?? 0;
  const youtubeCount = mediaCountMap.get("youtube") ?? 0;

  return {
    entity,
    kpis: {
      total: bundle?.total ?? 0,
      positive: bundle?.positive ?? 0,
      negative: bundle?.negative ?? 0,
      neutral: bundle?.neutral ?? 0,
    },
    mediaWiseCount: MEDIA_TYPES.map((mediaType) => ({
      mediaType,
      count: mediaCountMap.get(mediaType) ?? 0,
    })),
    mediaSentimentBreakdown,
    topPublications: bundle?.publications ?? [],
    topEditions: bundle?.editions ?? [],
    twitterEngagement:
      twitterCount > 0
        ? {
            likes: bundle?.tw_likes ?? 0,
            retweets: bundle?.tw_retweets ?? 0,
            replies: bundle?.tw_replies ?? 0,
            quotes: bundle?.tw_quotes ?? 0,
            views: bundle?.tw_views ?? 0,
            bookmarks: bundle?.tw_bookmarks ?? 0,
          }
        : undefined,
    youtubeEngagement:
      youtubeCount > 0
        ? {
            likes: bundle?.yt_likes ?? 0,
            comments: bundle?.yt_comments ?? 0,
            views: bundle?.yt_views ?? 0,
          }
        : undefined,
    topWebsites: bundle?.websites ?? [],
    lastUpdated: Date.now(),
  };
}
