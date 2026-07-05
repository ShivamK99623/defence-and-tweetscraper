export type DefenceEntity =
  | "Defence Minister"
  | "Indian Army"
  | "Indian Navy"
  | "Indian Air Force"
  | "Indian Coast Guard";

export type MediaType = "print" | "online" | "twitter" | "youtube";

export type SentimentType = "positive" | "negative" | "neutral" | "unknown";

export interface NewsRecord {
  id: string;
  entity: DefenceEntity;
  mediaType: MediaType;
  heading?: string;
  summary?: string;
  content?: string;
  publication?: string;
  website?: string;
  channelName?: string;
  handleName?: string;
  edition?: string;
  language?: string;
  sentiment?: string;
  author?: string;
  publishedAt?: string;
  columnOrder: string[];
  rawData: Record<string, unknown>;
}

export interface NewsFilters {
  entity?: DefenceEntity;
  mediaType?: MediaType;
  sentiment?: string;
  language?: string;
  publication?: string;
  website?: string;
  edition?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KpiMetrics {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  print: number;
  online: number;
  twitter: number;
  youtube: number;
  positivePercent: number;
  negativePercent: number;
  neutralPercent: number;
}

export interface EntityDistribution {
  entity: DefenceEntity;
  count: number;
}

export interface MediaDistribution {
  mediaType: MediaType;
  count: number;
}

export interface TrendDataPoint {
  date: string;
  print: number;
  online: number;
  twitter: number;
  youtube: number;
  total: number;
}

export interface TopNewsItem {
  id: string;
  heading: string;
  sentiment: string;
  mediaType: MediaType;
  engagement: number;
  url?: string;
  publishedAt?: string;
}

export interface OverviewAnalytics {
  kpis: KpiMetrics;
  entityDistribution: EntityDistribution[];
  mediaDistribution: MediaDistribution[];
  topPositiveNews: TopNewsItem[];
  topNegativeNews: TopNewsItem[];
  dailyTrend: TrendDataPoint[];
  topEditions: { edition: string; count: number }[];
  topOnlineSources: { website: string; count: number }[];
  lastUpdated: string;
}

export interface EntityAnalytics {
  entity: DefenceEntity;
  kpis: Pick<KpiMetrics, "total" | "positive" | "negative" | "neutral">;
  mediaWiseCount: MediaDistribution[];
  mediaSentimentBreakdown: {
    mediaType: MediaType;
    positive: number;
    negative: number;
    neutral: number;
  }[];
  topPublications: { publication: string; count: number }[];
  topEditions: { edition: string; count: number }[];
  twitterEngagement?: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views: number;
    bookmarks: number;
  };
  youtubeEngagement?: {
    likes: number;
    comments: number;
    views: number;
  };
  topWebsites: { website: string; count: number }[];
  lastUpdated: string;
}
