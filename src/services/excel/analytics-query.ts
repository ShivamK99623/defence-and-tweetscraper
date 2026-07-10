import { createHash } from "crypto";
import { DEFENCE_ENTITIES, MEDIA_TYPES } from "@/constants";
import { sanitizeSearchQuery } from "@/lib/search";
import type {
  DefenceEntity,
  EntityAnalytics,
  MediaType,
  NewsFilters,
  OverviewAnalytics,
  TopNewsItem,
} from "@/types";
import { getDatabase } from "./db";
import {
  buildTableConditions,
  buildCategoryFromClause,
  entityCategoryExpr,
  isEntityScoped,
  getConfigs,
  sqlDateExpr,
  type TableQueryConfig,
} from "./query";

interface ExpandedRow {
  media_type: MediaType;
  source_id: string;
  source_table: string;
  entity: DefenceEntity;
  sentiment: string;
  published_at: string;
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
    return `TRIM(COALESCE(${table}.url, ''))`;
  }
  if (config.mediaType === "youtube") {
    return `TRIM(COALESCE(${table}.youtube_url, ''))`;
  }
  return "''";
}

function engagementExpression(config: TableQueryConfig, table: string): string {
  if (config.mediaType === "twitter") {
    return `(
      COALESCE(CAST(${table}.likes AS INTEGER), 0) +
      COALESCE(CAST(${table}.retweets AS INTEGER), 0) +
      COALESCE(CAST(${table}.replies AS INTEGER), 0) +
      COALESCE(CAST(${table}.viewCount AS INTEGER), 0)
    )`;
  }
  if (config.mediaType === "youtube") {
    return `(
      COALESCE(CAST(${table}.comment_count AS INTEGER), 0) +
      COALESCE(CAST(${table}.like_count AS INTEGER), 0)
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
  return `COALESCE(CAST(${table}.${column} AS INTEGER), 0)`;
}

function youtubeMetricColumn(
  config: TableQueryConfig,
  table: string,
  column: string,
  fallback = "0"
): string {
  if (config.mediaType !== "youtube") return fallback;
  return `COALESCE(CAST(${table}.${column} AS INTEGER), 0)`;
}

function buildExpandedSelect(
  config: TableQueryConfig,
  filters: NewsFilters
): { sql: string; params: unknown[] } {
  const table = config.table;
  const { sql: whereSql, params } = buildTableConditions(config, filters);
  const heading = headingColumn(config);
  const entitySelect = isEntityScoped(filters)
    ? "je.value"
    : entityCategoryExpr(table);
  const edition = config.editionColumn
    ? `TRIM(COALESCE(${table}.${config.editionColumn}, ''))`
    : "''";
  const publication = config.publicationColumn
    ? `TRIM(COALESCE(${table}.${config.publicationColumn}, ''))`
    : "''";
  const website =
    config.mediaType === "online"
      ? publication
      : config.publicationColumn
        ? `TRIM(COALESCE(${table}.${config.publicationColumn}, ''))`
        : "''";

  const sql = `
    SELECT
      '${config.mediaType}' AS media_type,
      CAST(${table}.${config.idColumn} AS TEXT) AS source_id,
      '${table}' AS source_table,
      ${entitySelect} AS entity,
      LOWER(TRIM(COALESCE(${table}.${config.sentimentColumn}, ''))) AS sentiment,
      ${table}.${config.dateColumn} AS published_at,
      ${sqlDateExpr(config, table)} AS calendar_date,
      TRIM(COALESCE(${table}.${heading}, '')) AS heading,
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

function buildExpandedCte(filters: NewsFilters): { cte: string; params: unknown[] } {
  const normalizedFilters = normalizeFilters(filters);
  const configs = getConfigs(normalizedFilters.mediaType);
  const parts: string[] = [];
  const params: unknown[] = [];

  for (const config of configs) {
    const { sql, params: partParams } = buildExpandedSelect(
      config,
      normalizedFilters
    );
    parts.push(sql);
    params.push(...partParams);
  }

  if (parts.length === 0) {
    return {
      cte: `
        expanded AS (
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
    cte: `expanded AS (${parts.join(" UNION ALL ")})`,
    params,
  };
}

const DEDUPED_CTE = `
  deduped AS (
    SELECT * FROM (
      SELECT
        expanded.*,
        ROW_NUMBER() OVER (
          PARTITION BY media_type, source_id
          ORDER BY datetime(published_at) DESC
        ) AS rn
      FROM expanded
    )
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
    publishedAt: row.published_at || undefined,
  };
}

function queryTopMinisterNews(
  filters: NewsFilters,
  sentiment: "positive" | "negative"
): TopNewsItem[] {
  const database = getDatabase();
  const { cte, params } = buildExpandedCte(filters);
  const sql = `
    WITH ${cte},
    ${DEDUPED_CTE}
    SELECT *
    FROM deduped
    WHERE entity = 'Defence Minister'
      AND media_type IN ('twitter', 'youtube')
      AND heading != ''
      AND sentiment = ?
    ORDER BY engagement DESC
    LIMIT 10
  `;

  const rows = database
    .prepare(sql)
    .all(...params, sentiment) as ExpandedRow[];

  return rows.map(toTopNewsItem);
}

export function queryOverviewAnalytics(filters: NewsFilters): OverviewAnalytics {
  const database = getDatabase();
  const { cte, params } = buildExpandedCte(filters);

  const kpiRow = database
    .prepare(
      `
      WITH ${cte},
      ${DEDUPED_CTE}
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) AS positive,
        SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) AS negative,
        SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) AS neutral,
        SUM(CASE WHEN media_type = 'print' THEN 1 ELSE 0 END) AS print,
        SUM(CASE WHEN media_type = 'online' THEN 1 ELSE 0 END) AS online,
        SUM(CASE WHEN media_type = 'twitter' THEN 1 ELSE 0 END) AS twitter,
        SUM(CASE WHEN media_type = 'youtube' THEN 1 ELSE 0 END) AS youtube
      FROM deduped
    `
    )
    .get(...params) as {
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    print: number;
    online: number;
    twitter: number;
    youtube: number;
  };

  const entityRows = database
    .prepare(
      `
      WITH ${cte}
      SELECT entity, COUNT(*) AS count
      FROM expanded
      GROUP BY entity
      ORDER BY count DESC
    `
    )
    .all(...params) as { entity: string; count: number }[];

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

  const trendRows = database
    .prepare(
      `
      WITH ${cte},
      ${DEDUPED_CTE}
      SELECT
        calendar_date AS date,
        SUM(CASE WHEN media_type = 'print' THEN 1 ELSE 0 END) AS print,
        SUM(CASE WHEN media_type = 'online' THEN 1 ELSE 0 END) AS online,
        SUM(CASE WHEN media_type = 'twitter' THEN 1 ELSE 0 END) AS twitter,
        SUM(CASE WHEN media_type = 'youtube' THEN 1 ELSE 0 END) AS youtube
      FROM deduped
      WHERE calendar_date IS NOT NULL
        AND CAST(strftime('%Y', calendar_date) AS INTEGER) BETWEEN 2000 AND 2035
      GROUP BY calendar_date
      ORDER BY calendar_date
    `
    )
    .all(...params) as {
    date: string;
    print: number;
    online: number;
    twitter: number;
    youtube: number;
  }[];

  const editionRows = database
    .prepare(
      `
      WITH ${cte},
      ${DEDUPED_CTE}
      SELECT edition, COUNT(*) AS count
      FROM deduped
      WHERE edition != ''
      GROUP BY edition
      ORDER BY count DESC
      LIMIT 10
    `
    )
    .all(...params) as { edition: string; count: number }[];

  const websiteRows = database
    .prepare(
      `
      WITH ${cte},
      ${DEDUPED_CTE}
      SELECT COALESCE(NULLIF(website, ''), publication) AS website, COUNT(*) AS count
      FROM deduped
      WHERE media_type = 'online'
        AND COALESCE(NULLIF(website, ''), publication) != ''
      GROUP BY COALESCE(NULLIF(website, ''), publication)
      ORDER BY count DESC
      LIMIT 10
    `
    )
    .all(...params) as { website: string; count: number }[];

  const total = kpiRow?.total ?? 0;
  const positive = kpiRow?.positive ?? 0;
  const negative = kpiRow?.negative ?? 0;
  const neutral = kpiRow?.neutral ?? 0;

  return {
    kpis: {
      total,
      positive,
      negative,
      neutral,
      print: kpiRow?.print ?? 0,
      online: kpiRow?.online ?? 0,
      twitter: kpiRow?.twitter ?? 0,
      youtube: kpiRow?.youtube ?? 0,
      positivePercent: pct(positive, total),
      negativePercent: pct(negative, total),
      neutralPercent: pct(neutral, total),
    },
    entityDistribution,
    mediaDistribution: MEDIA_TYPES.map((mediaType) => ({
      mediaType,
      count:
        mediaType === "print"
          ? (kpiRow?.print ?? 0)
          : mediaType === "online"
            ? (kpiRow?.online ?? 0)
            : mediaType === "twitter"
              ? (kpiRow?.twitter ?? 0)
              : (kpiRow?.youtube ?? 0),
    })),
    topPositiveNews: queryTopMinisterNews(filters, "positive"),
    topNegativeNews: queryTopMinisterNews(filters, "negative"),
    dailyTrend: trendRows.map((row) => ({
      date: row.date,
      print: row.print,
      online: row.online,
      twitter: row.twitter,
      youtube: row.youtube,
      total: row.print + row.online + row.twitter + row.youtube,
    })),
    topEditions: editionRows,
    topOnlineSources: websiteRows,
    lastUpdated: new Date().toISOString(),
  };
}

export function queryEntityAnalytics(
  filters: NewsFilters,
  entity: DefenceEntity
): EntityAnalytics {
  const database = getDatabase();
  const entityFilters = { ...filters, entity };
  const { cte, params } = buildExpandedCte(entityFilters);

  const kpiRow = database
    .prepare(
      `
      WITH ${cte}
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) AS positive,
        SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) AS negative,
        SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) AS neutral
      FROM expanded
    `
    )
    .get(...params) as {
    total: number;
    positive: number;
    negative: number;
    neutral: number;
  };

  const mediaRows = database
    .prepare(
      `
      WITH ${cte}
      SELECT media_type, COUNT(*) AS count
      FROM expanded
      GROUP BY media_type
    `
    )
    .all(...params) as { media_type: MediaType; count: number }[];

  const mediaCountMap = new Map(
    mediaRows.map((row) => [row.media_type, row.count])
  );

  const sentimentRows = database
    .prepare(
      `
      WITH ${cte}
      SELECT media_type, sentiment, COUNT(*) AS count
      FROM expanded
      GROUP BY media_type, sentiment
    `
    )
    .all(...params) as {
    media_type: MediaType;
    sentiment: string;
    count: number;
  }[];

  const twitterRow = database
    .prepare(
      `
      WITH ${cte}
      SELECT
        SUM(tw_likes) AS likes,
        SUM(tw_retweets) AS retweets,
        SUM(tw_replies) AS replies,
        SUM(tw_quotes) AS quotes,
        SUM(tw_views) AS views,
        SUM(tw_bookmarks) AS bookmarks
      FROM expanded
      WHERE media_type = 'twitter'
    `
    )
    .get(...params) as {
    likes: number | null;
    retweets: number | null;
    replies: number | null;
    quotes: number | null;
    views: number | null;
    bookmarks: number | null;
  };

  const youtubeRow = database
    .prepare(
      `
      WITH ${cte}
      SELECT
        SUM(yt_likes) AS likes,
        SUM(yt_comments) AS comments,
        SUM(yt_views) AS views
      FROM expanded
      WHERE media_type = 'youtube'
    `
    )
    .get(...params) as {
    likes: number | null;
    comments: number | null;
    views: number | null;
  };

  const publicationRows = database
    .prepare(
      `
      WITH ${cte}
      SELECT publication, COUNT(*) AS count
      FROM expanded
      WHERE media_type = 'print' AND publication != ''
      GROUP BY publication
      ORDER BY count DESC
      LIMIT 10
    `
    )
    .all(...params) as { publication: string; count: number }[];

  const editionRows = database
    .prepare(
      `
      WITH ${cte}
      SELECT edition, COUNT(*) AS count
      FROM expanded
      WHERE media_type = 'print' AND edition != ''
      GROUP BY edition
      ORDER BY count DESC
      LIMIT 10
    `
    )
    .all(...params) as { edition: string; count: number }[];

  const websiteRows = database
    .prepare(
      `
      WITH ${cte}
      SELECT COALESCE(NULLIF(website, ''), publication) AS website, COUNT(*) AS count
      FROM expanded
      WHERE media_type = 'online'
        AND COALESCE(NULLIF(website, ''), publication) != ''
      GROUP BY COALESCE(NULLIF(website, ''), publication)
      ORDER BY count DESC
      LIMIT 10
    `
    )
    .all(...params) as { website: string; count: number }[];

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
      total: kpiRow?.total ?? 0,
      positive: kpiRow?.positive ?? 0,
      negative: kpiRow?.negative ?? 0,
      neutral: kpiRow?.neutral ?? 0,
    },
    mediaWiseCount: MEDIA_TYPES.map((mediaType) => ({
      mediaType,
      count: mediaCountMap.get(mediaType) ?? 0,
    })),
    mediaSentimentBreakdown,
    topPublications: publicationRows,
    topEditions: editionRows,
    twitterEngagement:
      twitterCount > 0
        ? {
            likes: twitterRow?.likes ?? 0,
            retweets: twitterRow?.retweets ?? 0,
            replies: twitterRow?.replies ?? 0,
            quotes: twitterRow?.quotes ?? 0,
            views: twitterRow?.views ?? 0,
            bookmarks: twitterRow?.bookmarks ?? 0,
          }
        : undefined,
    youtubeEngagement:
      youtubeCount > 0
        ? {
            likes: youtubeRow?.likes ?? 0,
            comments: youtubeRow?.comments ?? 0,
            views: youtubeRow?.views ?? 0,
          }
        : undefined,
    topWebsites: websiteRows,
    lastUpdated: new Date().toISOString(),
  };
}
