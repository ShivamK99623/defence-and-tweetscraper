import type {
  DefenceEntity,
  EntityAnalytics,
  MediaType,
  NewsFilters,
  NewsRecord,
  OverviewAnalytics,
} from "@/types";
import {
  DEFENCE_ENTITIES,
  ENTITY_TO_SLUG,
  ENTITY_COLORS,
  MEDIA_COLORS,
  MEDIA_LABELS,
  MEDIA_TYPES,
  SENTIMENT_COLORS,
} from "@/constants";
import {
  queryEntityAnalytics,
  queryOverviewAnalytics,
  queryRecordsByIds,
} from "@/services/excel";

export interface EntityReportSection {
  entity: DefenceEntity;
  slug: string;
  title: string;
  analytics: EntityAnalytics;
  newsByMedia: Record<MediaType, NewsRecord[]>;
}

export interface ReportData {
  overview: OverviewAnalytics;
  entities: EntityReportSection[];
  generatedAt: string;
  filterSummary: string;
}

function buildFilterSummary(filters: NewsFilters): string {
  const parts: string[] = [];
  if (filters.sentiment) parts.push(`Sentiment: ${filters.sentiment}`);
  if (filters.mediaType) parts.push(`Media: ${MEDIA_LABELS[filters.mediaType]}`);
  if (filters.startDate) parts.push(`From: ${filters.startDate}`);
  if (filters.endDate) parts.push(`To: ${filters.endDate}`);
  if (filters.publication) parts.push(`Publication: ${filters.publication}`);
  if (filters.edition) parts.push(`Edition: ${filters.edition}`);
  if (filters.website) parts.push(`Website: ${filters.website}`);
  if (filters.search) parts.push(`Search: ${filters.search}`);
  return parts.length > 0 ? parts.join(" · ") : "All records";
}

const ENTITY_TITLES: Record<DefenceEntity, string> = {
  "Defence Minister": "Defence Minister — Media Intelligence",
  "Indian Army": "Indian Army — Media Intelligence",
  "Indian Navy": "Indian Navy — Media Intelligence",
  "Indian Air Force": "Indian Air Force — Media Intelligence",
  "Indian Coast Guard": "Indian Coast Guard — Media Intelligence",
};

function groupRecordsByMedia(
  records: NewsRecord[]
): Record<MediaType, NewsRecord[]> {
  return MEDIA_TYPES.reduce(
    (acc, mediaType) => {
      acc[mediaType] = records.filter((record) => record.mediaType === mediaType);
      return acc;
    },
    {} as Record<MediaType, NewsRecord[]>
  );
}

export function buildReportData(
  filters: NewsFilters = {},
  options?: {
    entityOnly?: DefenceEntity;
    selectedNewsIds?: string[];
  }
): ReportData {
  const overview = queryOverviewAnalytics(filters);
  const selectedIds = options?.selectedNewsIds ?? [];

  const entitiesToInclude = options?.entityOnly
    ? DEFENCE_ENTITIES.filter((entity) => entity === options.entityOnly)
    : DEFENCE_ENTITIES;

  const entities: EntityReportSection[] = entitiesToInclude.map((entity) => {
    const entityFilters: NewsFilters = { ...filters, entity };
    const analytics = queryEntityAnalytics(entityFilters, entity);

    const selectedRecords =
      selectedIds.length > 0
        ? queryRecordsByIds(entityFilters, selectedIds)
        : [];

    return {
      entity,
      slug: ENTITY_TO_SLUG[entity],
      title: ENTITY_TITLES[entity],
      analytics,
      newsByMedia: groupRecordsByMedia(selectedRecords),
    };
  });

  const filterParts = [buildFilterSummary(filters)];
  if (selectedIds.length > 0) {
    filterParts.push(`${selectedIds.length} selected news items`);
  }

  return {
    overview,
    entities,
    generatedAt: new Date().toISOString(),
    filterSummary: filterParts.join(" · "),
  };
}

export function entityKpisFromAnalytics(analytics: EntityAnalytics) {
  const { kpis } = analytics;
  return {
    ...kpis,
    print:
      analytics.mediaWiseCount.find((m) => m.mediaType === "print")?.count ?? 0,
    online:
      analytics.mediaWiseCount.find((m) => m.mediaType === "online")?.count ?? 0,
    twitter:
      analytics.mediaWiseCount.find((m) => m.mediaType === "twitter")?.count ??
      0,
    youtube:
      analytics.mediaWiseCount.find((m) => m.mediaType === "youtube")?.count ?? 0,
    positivePercent: kpis.total
      ? Math.round((kpis.positive / kpis.total) * 100)
      : 0,
    negativePercent: kpis.total
      ? Math.round((kpis.negative / kpis.total) * 100)
      : 0,
    neutralPercent: kpis.total
      ? Math.round((kpis.neutral / kpis.total) * 100)
      : 0,
  };
}

export function overviewDistributionItems(overview: OverviewAnalytics) {
  return {
    entityItems: overview.entityDistribution.map((d) => ({
      label: d.entity,
      value: d.count,
      color: ENTITY_COLORS[d.entity as DefenceEntity] ?? "#94a3b8",
    })),
    mediaItems: overview.mediaDistribution.map((d) => ({
      label: MEDIA_LABELS[d.mediaType],
      value: d.count,
      color: MEDIA_COLORS[d.mediaType],
    })),
  };
}

export { SENTIMENT_COLORS };
