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
  filterRecords,
  generateEntityAnalytics,
  generateOverviewAnalytics,
  getCachedRecords,
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

export function buildReportData(
  filters: NewsFilters = {},
  options?: {
    entityOnly?: DefenceEntity;
    selectedNewsIds?: string[];
  }
): ReportData {
  const records = getCachedRecords();
  const filtered = filterRecords(records, filters);
  const overview = generateOverviewAnalytics(filtered);
  const selectedSet = options?.selectedNewsIds?.length
    ? new Set(options.selectedNewsIds)
    : null;

  const entitiesToInclude = options?.entityOnly
    ? DEFENCE_ENTITIES.filter((e) => e === options.entityOnly)
    : DEFENCE_ENTITIES;

  const entities: EntityReportSection[] = entitiesToInclude.map((entity) => {
    const entityFilters: NewsFilters = { ...filters, entity };
    const entityRecords = filterRecords(records, entityFilters);
    const analytics = generateEntityAnalytics(entityRecords, entity);

    const newsByMedia = MEDIA_TYPES.reduce(
      (acc, mediaType) => {
        const mediaRecords = entityRecords.filter(
          (r) => r.mediaType === mediaType
        );
        acc[mediaType] = selectedSet
          ? mediaRecords.filter((r) => selectedSet.has(r.id))
          : [];
        return acc;
      },
      {} as Record<MediaType, NewsRecord[]>
    );

    return {
      entity,
      slug: ENTITY_TO_SLUG[entity],
      title: ENTITY_TITLES[entity],
      analytics,
      newsByMedia,
    };
  });

  const filterParts = [buildFilterSummary(filters)];
  if (selectedSet) {
    filterParts.push(`${selectedSet.size} selected news items`);
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
      color: ENTITY_COLORS[d.entity],
    })),
    mediaItems: overview.mediaDistribution.map((d) => ({
      label: MEDIA_LABELS[d.mediaType],
      value: d.count,
      color: MEDIA_COLORS[d.mediaType],
    })),
  };
}

export { SENTIMENT_COLORS };
