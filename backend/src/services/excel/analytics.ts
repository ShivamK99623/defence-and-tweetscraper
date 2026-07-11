import type {
  DefenceEntity,
  EntityAnalytics,
  KpiMetrics,
  MediaType,
  NewsRecord,
  OverviewAnalytics,
  TopNewsItem,
} from "@/types";
import { DEFENCE_ENTITIES, MEDIA_TYPES } from "@/constants";
import { getNumericValue, isSheetSerialColumn, isUrlColumn, getIstCalendarDate } from "@/lib/utils";
import { getRecordSourceKey } from "./reader-utils";
import { parseISO, isValid } from "date-fns";

/** One physical news row per media source — avoids inflating overview KPIs when multiple entities share a story. */
function dedupeRecordsBySource(records: NewsRecord[]): NewsRecord[] {
  const seen = new Map<string, NewsRecord>();
  for (const record of records) {
    const key = `${record.mediaType}:${getRecordSourceKey(record)}`;
    if (!seen.has(key)) {
      seen.set(key, record);
    }
  }
  return Array.from(seen.values());
}

function computeKpis(records: NewsRecord[]): KpiMetrics {
  const total = records.length;
  const positive = records.filter((r) => r.sentiment === "positive").length;
  const negative = records.filter((r) => r.sentiment === "negative").length;
  const neutral = records.filter((r) => r.sentiment === "neutral").length;
  const print = records.filter((r) => r.mediaType === "print").length;
  const online = records.filter((r) => r.mediaType === "online").length;
  const twitter = records.filter((r) => r.mediaType === "twitter").length;
  const youtube = records.filter((r) => r.mediaType === "youtube").length;

  return {
    total,
    positive,
    negative,
    neutral,
    print,
    online,
    twitter,
    youtube,
    positivePercent: total ? Math.round((positive / total) * 100) : 0,
    negativePercent: total ? Math.round((negative / total) * 100) : 0,
    neutralPercent: total ? Math.round((neutral / total) * 100) : 0,
  };
}

function groupCount<T extends string>(
  records: NewsRecord[],
  getter: (r: NewsRecord) => T | undefined
): { key: T; count: number }[] {
  const map = new Map<T, number>();
  for (const r of records) {
    const key = getter(r);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function isPlausibleNewsDate(date: Date): boolean {
  const year = date.getFullYear();
  return year >= 2000 && year <= 2035;
}

function getDateKey(publishedAt?: string): string | null {
  if (!publishedAt) return null;
  const istDate = getIstCalendarDate(publishedAt);
  if (!istDate) return null;

  try {
    const d = parseISO(istDate);
    if (!isValid(d)) return null;
    if (!isPlausibleNewsDate(d)) return null;
    return istDate;
  } catch {
    return null;
  }
}

function computeSocialEngagement(record: NewsRecord): number {
  const { rawData, mediaType } = record;

  if (mediaType === "twitter") {
    return (
      getNumericValue(rawData.likes) +
      getNumericValue(rawData.retweets) +
      getNumericValue(rawData.replies) +
      getNumericValue(rawData.viewCount)
    );
  }

  if (mediaType === "youtube") {
    return (
      getNumericValue(rawData.comment_count) +
      getNumericValue(rawData.like_count)
    );
  }

  return 0;
}

function extractNewsUrl(record: NewsRecord): string | undefined {
  const { rawData, mediaType } = record;

  if (mediaType === "twitter") {
    const url = rawData.url;
    return url ? String(url).trim() : undefined;
  }

  if (mediaType === "youtube") {
    const url = rawData.youtube_url ?? rawData.youtubeUrl;
    return url ? String(url).trim() : undefined;
  }

  return undefined;
}

function getTopEngagedMinisterNews(
  records: NewsRecord[],
  sentiment: "positive" | "negative"
): TopNewsItem[] {
  return records
    .filter((r) => r.entity === "Defence Minister")
    .filter((r) => r.mediaType === "twitter" || r.mediaType === "youtube")
    .filter((r) => r.sentiment === sentiment && r.heading?.trim())
    .map((r) => ({
      id: r.id,
      heading: r.heading!,
      sentiment: r.sentiment ?? "unknown",
      mediaType: r.mediaType,
      engagement: computeSocialEngagement(r),
      url: extractNewsUrl(r),
      publishedAt: r.publishedAt,
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10);
}

export function generateOverviewAnalytics(
  records: NewsRecord[]
): OverviewAnalytics {
  const uniqueRecords = dedupeRecordsBySource(records);
  const kpis = computeKpis(uniqueRecords);

  const entityDistribution = DEFENCE_ENTITIES.map((entity) => ({
    entity,
    count: records.filter((r) => r.entity === entity).length,
  }));

  const mediaDistribution = MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    count: uniqueRecords.filter((r) => r.mediaType === mediaType).length,
  }));

  const topPositiveNews = getTopEngagedMinisterNews(uniqueRecords, "positive");
  const topNegativeNews = getTopEngagedMinisterNews(uniqueRecords, "negative");

  const trendMap = new Map<
    string,
    { print: number; online: number; twitter: number; youtube: number }
  >();

  for (const r of uniqueRecords) {
    const dateKey = getDateKey(r.publishedAt);
    if (!dateKey) continue;
    const entry = trendMap.get(dateKey) ?? {
      print: 0,
      online: 0,
      twitter: 0,
      youtube: 0,
    };
    entry[r.mediaType]++;
    trendMap.set(dateKey, entry);
  }

  const dailyTrend = Array.from(trendMap.entries())
    .filter(([date]) => {
      const d = parseISO(date);
      return isValid(d) && isPlausibleNewsDate(d);
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      ...counts,
      total: counts.print + counts.online + counts.twitter + counts.youtube,
    }));

  const topEditions = groupCount(uniqueRecords, (r) =>
    r.edition ? r.edition : undefined
  )
    .slice(0, 10)
    .map(({ key, count }) => ({ edition: key, count }));

  const onlineRecords = uniqueRecords.filter((r) => r.mediaType === "online");
  const topOnlineSources = groupCount(onlineRecords, (r) =>
    r.website || r.publication ? (r.website ?? r.publication) : undefined
  )
    .slice(0, 10)
    .map(({ key, count }) => ({ website: key, count }));

  return {
    kpis,
    entityDistribution,
    mediaDistribution,
    topPositiveNews,
    topNegativeNews,
    dailyTrend,
    topEditions,
    topOnlineSources,
    lastUpdated: new Date().toISOString(),
  };
}

export function generateEntityAnalytics(
  records: NewsRecord[],
  entity: DefenceEntity
): EntityAnalytics {
  const entityRecords = records.filter((r) => r.entity === entity);
  const fullKpis = computeKpis(entityRecords);

  const mediaWiseCount = MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    count: entityRecords.filter((r) => r.mediaType === mediaType).length,
  }));

  const mediaSentimentBreakdown = MEDIA_TYPES.map((mediaType) => {
    const mediaRecords = entityRecords.filter((r) => r.mediaType === mediaType);
    return {
      mediaType,
      positive: mediaRecords.filter((r) => r.sentiment === "positive").length,
      negative: mediaRecords.filter((r) => r.sentiment === "negative").length,
      neutral: mediaRecords.filter((r) => r.sentiment === "neutral").length,
    };
  });

  const printRecords = entityRecords.filter((r) => r.mediaType === "print");
  const topPublications = groupCount(printRecords, (r) => r.publication)
    .slice(0, 10)
    .map(({ key, count }) => ({ publication: key, count }));

  const topEditions = groupCount(printRecords, (r) => r.edition)
    .slice(0, 10)
    .map(({ key, count }) => ({ edition: key, count }));

  const twitterRecords = entityRecords.filter((r) => r.mediaType === "twitter");
  const twitterEngagement =
    twitterRecords.length > 0
      ? {
          likes: twitterRecords.reduce(
            (s, r) => s + getNumericValue(r.rawData.likes),
            0
          ),
          retweets: twitterRecords.reduce(
            (s, r) => s + getNumericValue(r.rawData.retweets),
            0
          ),
          replies: twitterRecords.reduce(
            (s, r) => s + getNumericValue(r.rawData.replies),
            0
          ),
          quotes: twitterRecords.reduce(
            (s, r) => s + getNumericValue(r.rawData.quotes),
            0
          ),
          views: twitterRecords.reduce(
            (s, r) => s + getNumericValue(r.rawData.viewCount),
            0
          ),
          bookmarks: twitterRecords.reduce(
            (s, r) => s + getNumericValue(r.rawData.bookmarkCount),
            0
          ),
        }
      : undefined;

  const youtubeRecords = entityRecords.filter((r) => r.mediaType === "youtube");
  const youtubeEngagement =
    youtubeRecords.length > 0
      ? {
          likes: youtubeRecords.reduce(
            (s, r) => s + getNumericValue(r.rawData.like_count),
            0
          ),
          comments: youtubeRecords.reduce(
            (s, r) => s + getNumericValue(r.rawData.comment_count),
            0
          ),
          views: youtubeRecords.reduce(
            (s, r) => s + getNumericValue(r.rawData.viewCount),
            0
          ),
        }
      : undefined;

  const onlineRecords = entityRecords.filter((r) => r.mediaType === "online");
  const topWebsites = groupCount(onlineRecords, (r) =>
    r.website || r.publication ? (r.website ?? r.publication) : undefined
  )
    .slice(0, 10)
    .map(({ key, count }) => ({ website: key, count }));

  return {
    entity,
    kpis: {
      total: fullKpis.total,
      positive: fullKpis.positive,
      negative: fullKpis.negative,
      neutral: fullKpis.neutral,
    },
    mediaWiseCount,
    mediaSentimentBreakdown,
    topPublications,
    topEditions,
    twitterEngagement,
    youtubeEngagement,
    topWebsites,
    lastUpdated: new Date().toISOString(),
  };
}

export function getUniqueColumnKeys(records: NewsRecord[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const record of records) {
    for (const col of record.columnOrder) {
      if (!seen.has(col)) {
        seen.add(col);
        ordered.push(col);
      }
    }
  }

  return ordered.filter(
    (col) => !isSheetSerialColumn(col) && !isUrlColumn(col)
  );
}
