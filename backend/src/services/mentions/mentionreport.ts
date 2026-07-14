import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";


const REPORT_START = new Date("2026-06-25T00:00:00");
const REPORT_END = new Date("2026-07-12T23:59:59");
const DEFAULT_REPORT_TITLE = "Analytical Report on Operation Sindoor Controversy";

export interface ChartFilters {
  keyword?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  reportTitle?: string;
}

export interface ChartMeta {
  reportTitle: string;
  keyword: string;
  dateRange: { start: string; end: string };
}

function parseIsoDayStart(value: string | undefined | null): Date | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIsoDayEnd(value: string | undefined | null): Date | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveFilterRange(filters: ChartFilters = {}): { start: Date; end: Date } {
  const start = parseIsoDayStart(filters.startDate) ?? REPORT_START;
  const end = parseIsoDayEnd(filters.endDate) ?? REPORT_END;
  if (start > end) return { start: end, end: start };
  return { start, end };
}

function normalizeKeyword(raw: string | undefined | null): string {
  return (raw ?? "").trim().toLowerCase();
}

function matchesKeyword(keyword: string, ...parts: Array<string | undefined | null>): boolean {
  if (!keyword) return true;
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  return hay.includes(keyword);
}

function resolveReportTitle(filters: ChartFilters = {}): string {
  const title = (filters.reportTitle ?? "").trim();
  return title || DEFAULT_REPORT_TITLE;
}

export function buildChartMeta(filters: ChartFilters = {}): ChartMeta {
  const { start, end } = resolveFilterRange(filters);
  return {
    reportTitle: resolveReportTitle(filters),
    keyword: (filters.keyword ?? "").trim(),
    dateRange: { start: toIsoDate(start), end: toIsoDate(end) },
  };
}

export function parseChartFiltersFromQuery(query: any): ChartFilters {
  const pick = (key: string) => {
    const v = query[key];
    if (Array.isArray(v)) return String(v[0] ?? "");
    return typeof v === "string" ? v : "";
  };
  return {
    keyword: pick("keyword") || undefined,
    startDate: pick("startDate") || undefined,
    endDate: pick("endDate") || undefined,
    reportTitle: pick("reportTitle") || undefined,
  };
}


const DATA_FILES = {
  twitter: path.join( "reports/twitter/merged_timeline_graph.json"),
  online: path.join("reports/Op Sindoor_Online_25jun_to_12july.csv"),
  youtube: path.join( "reports/Op Sindoor_YT_25jun_to_12july.csv"),
  instagram: path.join("reports/Op Sindoor_Insta_25jun_to_12july.csv"),
  facebook: path.join("reports/Op Sindoor_FB_25jun_to_12july.csv"),
} as const;

export type PlatformKey = keyof typeof DATA_FILES;

export type SentimentBucket = "positive" | "negative" | "neutral";

export interface TopEntityRow {
  name: string;
  handle: string;
  link: string;
  mentions: number;
  engagement: number;
  followers: number | null;
  sentiment: SentimentBucket;
  sentimentMix: { positive: number; negative: number; neutral: number };
  rankLabel?: string;
  subLabel?: string;
}

export interface PostItem {
  name: string;
  handle: string;
  timestamp: string;
  text: string;
  language: string;
  sentiment: SentimentBucket;
  likes: number;
  shares: number;
  comments: number;
  views: number;
  url: string;
  image?: string;
}

export interface ArticleItem {
  domain: string;
  title: string;
  snippet: string;
  timestamp: string;
  language: string;
  sentiment: SentimentBucket;
  rankLabel: string;
  tag: string;
  url: string;
}

export interface VideoItem {
  channel: string;
  title: string;
  snippet: string;
  timestamp: string;
  language: string;
  sentiment: SentimentBucket;
  likes: number;
  comments: number;
  views: number;
  url: string;
}

export interface PlatformChartPayload {
  platform: PlatformKey;
  title: string;
  dateRange: { start: string; end: string };
  kpis: {
    totalMentions: number;
    uniqueSources: number;
    totalEngagement: number;
    totalReach: number;
    socialMentions: number;
    socialUsers: number;
    webMentions: number;
    webSites: number;
  };
  dailyTimeline: { date: string; count: number }[];
  sentiment: { name: string; value: number; color: string }[];
  engagementBreakdown?: { name: string; value: number }[];
  topEntities: TopEntityRow[];
  posts?: PostItem[];
  articles?: ArticleItem[];
  videos?: VideoItem[];
  chartTypes: {
    timeline: "line";
    sentiment: "pie";
    engagement: "bar" | null;
    ranking: "bar";
  };
  accentColor: string;
}

const PLATFORM_META: Record<
  PlatformKey,
  { title: string; accentColor: string; rankingLabel: string }
> = {
  twitter: {
    title: "Twitter / X",
    accentColor: "#0ea5e9",
    rankingLabel: "Top X Handles",
  },
  online: {
    title: "Online / Web",
    accentColor: "#059669",
    rankingLabel: "Top Websites",
  },
  youtube: {
    title: "YouTube",
    accentColor: "#dc2626",
    rankingLabel: "Top YT Channels",
  },
  instagram: {
    title: "Instagram",
    accentColor: "#e1306c",
    rankingLabel: "Top Instagram Handles",
  },
  facebook: {
    title: "Facebook",
    accentColor: "#1877f2",
    rankingLabel: "Top Facebook Pages",
  },
};

const SENTIMENT_COLORS: Record<SentimentBucket, string> = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#eab308",
};

const POSITIVE_HINTS = [
  "proud",
  "salute",
  "victory",
  "brave",
  "hero",
  "success",
  "strong",
  "respect",
  "honour",
  "honor",
  "jai hind",
  "great",
  "excellent",
  "support",
  "truth",
];

const NEGATIVE_HINTS = [
  "lie",
  "lied",
  "false",
  "controversy",
  "misled",
  "shame",
  "failed",
  "failure",
  "hypocris",
  "corrupt",
  "disgrace",
  "shameful",
  "propaganda",
  "anti national",
  "surrender",
  "insult",
];

function inDateRange(date: Date | null, start: Date, end: Date): boolean {
  if (!date || Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
}

/** @deprecated prefer inDateRange with explicit bounds */
function inReportRange(date: Date | null): boolean {
  return inDateRange(date, REPORT_START, REPORT_END);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeSentiment(raw: string | undefined | null): SentimentBucket {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.includes("pos")) return "positive";
  if (value.includes("neg")) return "negative";
  if (value.includes("neu")) return "neutral";
  return "neutral";
}

function inferTwitterSentiment(content: string): SentimentBucket {
  const text = content.toLowerCase();
  let score = 0;
  for (const word of POSITIVE_HINTS) {
    if (text.includes(word)) score += 1;
  }
  for (const word of NEGATIVE_HINTS) {
    if (text.includes(word)) score -= 1;
  }
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function parseEngagementNumber(raw: string | number | undefined | null): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const cleaned = String(raw).trim().replace(/,/g, "");
  if (!cleaned) return 0;
  const match = cleaned.match(/^([\d.]+)\s*([kKmM])?$/);
  if (!match) {
    const digits = Number(cleaned);
    return Number.isFinite(digits) ? digits : 0;
  }
  const base = Number(match[1]);
  const suffix = (match[2] ?? "").toLowerCase();
  if (suffix === "k") return Math.round(base * 1000);
  if (suffix === "m") return Math.round(base * 1_000_000);
  return Math.round(base);
}

function parseDmyDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 10);
  const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
}

function parseDotDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 10);
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
}

function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

function readCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf8");
  return parseCsv(content);
}

function buildDailyTimeline(
  dates: Date[],
  rangeStart: Date = REPORT_START,
  rangeEnd: Date = REPORT_END,
  fillRange = true
): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = toIsoDate(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (!fillRange) {
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }

  const timeline: { date: string; count: number }[] = [];
  const cursor = new Date(rangeStart);
  const end = new Date(rangeEnd);
  // normalize to day
  cursor.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  while (cursor <= end) {
    const key = toIsoDate(cursor);
    timeline.push({ date: key, count: counts.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return timeline;
}

function sentimentSeries(
  buckets: Record<SentimentBucket, number>
): { name: string; value: number; color: string }[] {
  return (["positive", "negative", "neutral"] as SentimentBucket[]).map(
    (key) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: buckets[key],
      color: SENTIMENT_COLORS[key],
    })
  );
}

interface EntityAccumulator {
  name: string;
  handle: string;
  mentions: number;
  engagement: number;
  followers: number | null;
  subLabel?: string;
  link?: string;
  sentiment: Record<SentimentBucket, number>;
}

function dominantSentiment(
  buckets: Record<SentimentBucket, number>
): SentimentBucket {
  return (["positive", "negative", "neutral"] as SentimentBucket[]).reduce(
    (best, key) => (buckets[key] > buckets[best] ? key : best),
    "neutral" as SentimentBucket
  );
}

function buildTopEntities(
  map: Map<string, EntityAccumulator>,
  limit = 24,
  sortBy: "engagement" | "mentions" = "engagement"
): TopEntityRow[] {
  return [...map.values()]
    .sort((a, b) =>
      sortBy === "mentions"
        ? b.mentions - a.mentions || b.engagement - a.engagement
        : b.engagement - a.engagement || b.mentions - a.mentions
    )
    .slice(0, limit)
    .map((item) => ({
      name: item.name,
      handle: item.handle,
      mentions: item.mentions,
      engagement: item.engagement,
      followers: item.followers ?? null,
      sentiment: dominantSentiment(item.sentiment),
      sentimentMix: {
        positive: item.sentiment.positive,
        negative: item.sentiment.negative,
        neutral: item.sentiment.neutral,
      },
      subLabel: item.subLabel,
      link: item.link ?? "",
    }));
}

function twoDigit(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatPostTimestamp(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${twoDigit(date.getUTCDate())} ${MONTH_SHORT[date.getUTCMonth()]} ${twoDigit(date.getUTCHours())}:${twoDigit(date.getUTCMinutes())}`;
}

function parseFirstUrl(raw: string | undefined | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (typeof entry === "string" && /^https?:\/\//i.test(entry.trim())) {
            return sanitizeHttpUrl(entry);
          }
        }
      }
    } catch {
      /* fall through */
    }
  }
  const match = trimmed.match(/https?:\/\/[^\s"'\]|,]+/i);
  return sanitizeHttpUrl(match ? match[0] : trimmed);
}

function sanitizeHttpUrl(raw: string | undefined | null): string {
  if (!raw) return "";
  // CSV noise-breaks like "youtube. com" / "watch?v=5LCY ZkwFxJ4"
  const cleaned = raw.replace(/\s+/g, "").trim();
  if (!/^https?:\/\//i.test(cleaned)) return "";
  try {
    // Validate URL shape
    // eslint-disable-next-line no-new
    new URL(cleaned);
    return cleaned;
  } catch {
    return cleaned.startsWith("http") ? cleaned : "";
  }
}

function extractDomain(rawUrl: string | undefined | null): string {
  const first = parseFirstUrl(rawUrl);
  if (!first) return "";
  try {
    const url = new URL(first);
    return url.hostname.replace(/^www\./, "");
  } catch {
    const match = String(first).match(/([a-z0-9-]+\.[a-z.]{2,})/i);
    return match ? match[1].replace(/^www\./, "") : "";
  }
}

function trimSnippet(value: string | undefined | null, max = 160): string {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function trackEntity(
  map: Map<string, EntityAccumulator>,
  key: string,
  displayName: string,
  handle: string,
  engagement: number,
  sentiment: SentimentBucket,
  extra?: { followers?: number | null; subLabel?: string, link?: string }
) {
  const existing = map.get(key) ?? {
    name: displayName,
    handle,
    mentions: 0,
    engagement: 0,
    followers: extra?.followers ?? null,
    subLabel: extra?.subLabel,
    sentiment: { positive: 0, negative: 0, neutral: 0 },
    link: extra?.link ?? "",
  };
  existing.mentions += 1;
  existing.engagement += engagement;
  if (extra?.followers != null) existing.followers = extra.followers;
  if (extra?.subLabel && !existing.subLabel) existing.subLabel = extra.subLabel;
  if (extra?.link && !existing.link) existing.link = extra.link;
  existing.sentiment[sentiment] += 1;
  map.set(key, existing);
}

interface TwitterImage {
  original?: string;
  local?: string;
  ok?: boolean;
}

interface TwitterRecord {
  username: string;
  datetime: string;
  content: string;
  statusHref?: string;
  images?: TwitterImage[];
  stats: {
    replies?: number;
    reposts?: number;
    likes?: number;
    views?: number;
  };
}

function twitterPostImage(item: TwitterRecord): string {
  const images = item.images ?? [];
  for (const image of images) {
    const remote = image.original?.trim();
    if (remote) return remote;
  }
  return "";
}

function loadTwitterData(filters: ChartFilters = {}): PlatformChartPayload {
  const { start, end } = resolveFilterRange(filters);
  const keyword = normalizeKeyword(filters.keyword);
  const raw = JSON.parse(fs.readFileSync(DATA_FILES.twitter, "utf8")) as TwitterRecord[];
  const filtered = raw.filter((item) => {
    const date = new Date(item.datetime);
    if (!inDateRange(date, start, end)) return false;
    return matchesKeyword(keyword, item.content, item.username);
  });

  const sentiment: Record<SentimentBucket, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  const handles = new Map<string, EntityAccumulator>();
  let likes = 0;
  let shares = 0;
  let comments = 0;
  let views = 0;
  const dates: Date[] = [];
  const users = new Set<string>();
  const posts: (PostItem & { engagement: number })[] = [];

  for (const item of filtered) {
    const date = new Date(item.datetime);
    dates.push(date);
    users.add(item.username);
    const bucket = inferTwitterSentiment(item.content);
    sentiment[bucket] += 1;

    const stats = item.stats ?? {};
    const itemLikes = stats.likes ?? 0;
    const itemShares = stats.reposts ?? 0;
    const itemComments = stats.replies ?? 0;
    const itemViews = stats.views ?? 0;

    likes += itemLikes;
    shares += itemShares;
    comments += itemComments;
    views += itemViews;

    const engagement = itemLikes + itemShares * 2 + itemComments;
    const handle = item.username.replace(/^@/, "");
    const postUrl = item.statusHref ? `https://x.com${item.statusHref}` : "";
    trackEntity(handles, handle, handle, `@${handle}`, engagement, bucket, {
      link: `https://x.com/${handle}`,
    });

    posts.push({
      name: handle,
      handle: `@${handle}`,
      timestamp: formatPostTimestamp(date),
      text: trimSnippet(item.content, 170),
      language: "en",
      sentiment: bucket,
      likes: itemLikes,
      shares: itemShares,
      comments: itemComments,
      views: itemViews,
      url: postUrl,
      image: twitterPostImage(item),
      engagement,
    });
  }

  const meta = PLATFORM_META.twitter;
  return {
    platform: "twitter",
    title: meta.title,
    dateRange: { start: toIsoDate(start), end: toIsoDate(end) },
    kpis: {
      totalMentions: filtered.length,
      uniqueSources: users.size,
      totalEngagement: likes + shares + comments,
      totalReach: views,
      socialMentions: filtered.length,
      socialUsers: users.size,
      webMentions: 0,
      webSites: 0,
    },
    dailyTimeline: buildDailyTimeline(dates, start, end),
    sentiment: sentimentSeries(sentiment),
    engagementBreakdown: [
      { name: "Likes", value: likes },
      { name: "Shares", value: shares },
      { name: "Comments", value: comments },
    ],
    topEntities: buildTopEntities(handles),
    posts: posts
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 24)
      .map(({ engagement: _engagement, ...post }) => post),
    chartTypes: {
      timeline: "line",
      sentiment: "pie",
      engagement: "bar",
      ranking: "bar",
    },
    accentColor: meta.accentColor,
  };
}

function loadOnlineData(filters: ChartFilters = {}): PlatformChartPayload {
  const { start, end } = resolveFilterRange(filters);
  const keyword = normalizeKeyword(filters.keyword);
  const rows = readCsv(DATA_FILES.online).filter((row) => {
    const date = parseDmyDate(row["Date & Time"]);
    if (!inDateRange(date, start, end)) return false;
    return matchesKeyword(
      keyword,
      row.Heading,
      row.Summary,
      row.Content,
      row.Publication
    );
  });

  const sentiment: Record<SentimentBucket, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  const publications = new Map<string, EntityAccumulator>();
  const dates: Date[] = [];
  const articles: (ArticleItem & { sortDate: number })[] = [];

  for (const row of rows) {
    const date = parseDmyDate(row["Date & Time"]);
    if (date) dates.push(date);
    const bucket = normalizeSentiment(row.Sentiment);
    sentiment[bucket] += 1;

    const articleUrl = parseFirstUrl(row.Links);
    const domain = extractDomain(articleUrl) || row.Publication?.trim() || "Unknown";
    const publicationName = row.Publication?.trim() || domain;
    trackEntity(publications, domain, domain, domain, 1, bucket, {
      subLabel: publicationName,
      link: articleUrl,
    });

    articles.push({
      domain,
      title: trimSnippet(row.Heading, 80),
      snippet: trimSnippet(row.Summary || row.Content, 90),
      timestamp: formatPostTimestamp(date),
      language: (row.Language?.trim().slice(0, 2) || "en").toLowerCase(),
      sentiment: bucket,
      rankLabel: "N/A",
      tag: "news",
      url: articleUrl,
      sortDate: date ? date.getTime() : 0,
    });
  }

  const meta = PLATFORM_META.online;
  return {
    platform: "online",
    title: meta.title,
    dateRange: { start: toIsoDate(start), end: toIsoDate(end) },
    kpis: {
      totalMentions: rows.length,
      uniqueSources: publications.size,
      totalEngagement: rows.length,
      totalReach: 0,
      socialMentions: 0,
      socialUsers: 0,
      webMentions: rows.length,
      webSites: publications.size,
    },
    dailyTimeline: buildDailyTimeline(dates, start, end),
    sentiment: sentimentSeries(sentiment),
    topEntities: buildTopEntities(publications, 24, "mentions"),
    articles: articles
      .sort((a, b) => b.sortDate - a.sortDate)
      .slice(0, 24)
      .map(({ sortDate: _sortDate, ...article }) => article),
    chartTypes: {
      timeline: "line",
      sentiment: "pie",
      engagement: null,
      ranking: "bar",
    },
    accentColor: meta.accentColor,
  };
}

function loadYouTubeData(filters: ChartFilters = {}): PlatformChartPayload {
  const { start, end } = resolveFilterRange(filters);
  const keyword = normalizeKeyword(filters.keyword);
  const rows = readCsv(DATA_FILES.youtube).filter((row) => {
    const date = parseDmyDate(row["Date & Time"]);
    if (!inDateRange(date, start, end)) return false;
    return matchesKeyword(keyword, row.Headline, row.Channel, row.Summary);
  });

  const sentiment: Record<SentimentBucket, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  const channels = new Map<string, EntityAccumulator>();
  const dates: Date[] = [];
  let likes = 0;
  let comments = 0;
  const videos: (VideoItem & { engagement: number })[] = [];

  for (const row of rows) {
    const date = parseDmyDate(row["Date & Time"]);
    if (date) dates.push(date);
    const bucket = normalizeSentiment(row.Semetiment ?? row.Sentiment);
    sentiment[bucket] += 1;

    const rowLikes = parseEngagementNumber(row.Likes);
    const rowComments = parseEngagementNumber(row.Comments);
    likes += rowLikes;
    comments += rowComments;

    const videoUrl = sanitizeHttpUrl(row.Link);
    const channel = row.Channel?.trim() || "Unknown";
    trackEntity(
      channels,
      channel,
      channel,
      channel,
      rowLikes + rowComments,
      bucket,
      {
        link: videoUrl,
      }
    );

    videos.push({
      channel,
      title: trimSnippet(row.Headline, 80),
      snippet: trimSnippet(row.Summary, 90),
      timestamp: formatPostTimestamp(date),
      language: (row.Language?.trim().slice(0, 2) || "en").toLowerCase(),
      sentiment: bucket,
      likes: rowLikes,
      comments: rowComments,
      views: 0,
      url: videoUrl,
      engagement: rowLikes + rowComments,
    });
  }

  const meta = PLATFORM_META.youtube;
  return {
    platform: "youtube",
    title: meta.title,
    dateRange: { start: toIsoDate(start), end: toIsoDate(end) },
    kpis: {
      totalMentions: rows.length,
      uniqueSources: channels.size,
      totalEngagement: likes + comments,
      totalReach: 0,
      socialMentions: rows.length,
      socialUsers: channels.size,
      webMentions: 0,
      webSites: 0,
    },
    dailyTimeline: buildDailyTimeline(dates, start, end),
    sentiment: sentimentSeries(sentiment),
    engagementBreakdown: [
      { name: "Likes", value: likes },
      { name: "Comments", value: comments },
    ],
    topEntities: buildTopEntities(channels),
    videos: videos
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 24)
      .map(({ engagement: _engagement, ...video }) => video),
    chartTypes: {
      timeline: "line",
      sentiment: "pie",
      engagement: "bar",
      ranking: "bar",
    },
    accentColor: meta.accentColor,
  };
}

function loadInstagramData(filters: ChartFilters = {}): PlatformChartPayload {
  const { start, end } = resolveFilterRange(filters);
  const keyword = normalizeKeyword(filters.keyword);
  const rows = readCsv(DATA_FILES.instagram).filter((row) => {
    const date = parseDotDate(row.CreatedAt);
    if (!inDateRange(date, start, end)) return false;
    return matchesKeyword(
      keyword,
      row.Handle,
      row.Headline,
      row.Caption,
      row.Content,
      row.Text,
      row.URL
    );
  });

  const sentiment: Record<SentimentBucket, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  const handles = new Map<string, EntityAccumulator>();
  const dates: Date[] = [];
  let totalEngagement = 0;
  const posts: (PostItem & { engagement: number })[] = [];

  for (const row of rows) {
    const date = parseDotDate(row.CreatedAt);
    if (date) dates.push(date);
    const bucket = normalizeSentiment(row.Sentiment);
    sentiment[bucket] += 1;

    const likes = parseEngagementNumber(row.Likes);
    const engagement =
      parseEngagementNumber(row.Engagement) || likes;
    totalEngagement += engagement;

    const handle = (row.Handle ?? "").replace(/\s+/g, " ").trim() || "Unknown";
    const handleKey = handle.replace(/^@/, "").toLowerCase();
    const postUrl = sanitizeHttpUrl(row.URL);
    const profileUrl = handleKey
      ? `https://www.instagram.com/${encodeURIComponent(handleKey)}/`
      : "";

    trackEntity(handles, handleKey, handle, `@${handle.replace(/^@/, "")}`, engagement, bucket, {
      link: profileUrl || postUrl,
    });

    posts.push({
      name: handle.replace(/^@/, ""),
      handle: `@${handle.replace(/^@/, "")}`,
      timestamp: formatPostTimestamp(date),
      text: trimSnippet(row.Headline || row.Caption || row.Content || "", 170),
      language: (row.Language || "en").trim() || "en",
      sentiment: bucket,
      likes,
      shares: 0,
      comments: 0,
      views: 0,
      url: postUrl || profileUrl,
      engagement,
    });
  }

  const meta = PLATFORM_META.instagram;
  return {
    platform: "instagram",
    title: meta.title,
    dateRange: { start: toIsoDate(start), end: toIsoDate(end) },
    kpis: {
      totalMentions: rows.length,
      uniqueSources: handles.size,
      totalEngagement,
      totalReach: 0,
      socialMentions: rows.length,
      socialUsers: handles.size,
      webMentions: 0,
      webSites: 0,
    },
    dailyTimeline: buildDailyTimeline(dates, start, end),
    sentiment: sentimentSeries(sentiment),
    topEntities: buildTopEntities(handles),
    posts: posts
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 24)
      .map(({ engagement: _engagement, ...post }) => post),
    chartTypes: {
      timeline: "line",
      sentiment: "pie",
      engagement: null,
      ranking: "bar",
    },
    accentColor: meta.accentColor,
  };
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000);
}

async function loadFacebookData(filters: ChartFilters = {}): Promise<PlatformChartPayload> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(DATA_FILES.facebook);
  const sheet = workbook.worksheets[0];
  const rows: {
    headline: string;
    sentiment: string;
    tags: string;
    createdAt: unknown;
    handle: string;
    language: string;
    url: string;
    likes: unknown;
  }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push({
      headline: String(row.getCell(2).text ?? "").trim(),
      sentiment: String(row.getCell(3).text ?? "").trim(),
      tags: String(row.getCell(4).text ?? "").trim(),
      createdAt: row.getCell(5).value,
      handle: String(row.getCell(6).text ?? "").trim(),
      language: String(row.getCell(7).text ?? "").trim(),
      url: String(row.getCell(8).text ?? "").trim(),
      likes: row.getCell(9).value,
    });
  });

  const parseFacebookDate = (raw: unknown): Date | null => {
    if (raw instanceof Date) return raw;
    if (typeof raw === "number") return excelSerialToDate(raw);
    return parseDotDate(String(raw));
  };

  const { start, end } = resolveFilterRange(filters);
  const keyword = normalizeKeyword(filters.keyword);
  const filtered = rows.filter((row) => {
    const date = parseFacebookDate(row.createdAt);
    if (!inDateRange(date, start, end)) return false;
    return matchesKeyword(keyword, row.headline, row.handle, row.tags);
  });

  const sentiment: Record<SentimentBucket, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  const handles = new Map<string, EntityAccumulator>();
  const dates: Date[] = [];
  let totalEngagement = 0;
  const posts: (PostItem & { engagement: number })[] = [];

  for (const row of filtered) {
    const date = parseFacebookDate(row.createdAt);
    if (date) dates.push(date);

    const bucket = normalizeSentiment(String(row.sentiment));
    sentiment[bucket] += 1;
    const likes = parseEngagementNumber(row.likes as string | number | null | undefined);
    totalEngagement += likes;

    const handle = String(row.handle || "Unknown").replace(/\s+/g, " ").trim() || "Unknown";
    const postUrl = sanitizeHttpUrl(row.url);
    trackEntity(handles, handle.toLowerCase(), handle, handle, likes, bucket, {
      link: postUrl,
    });

    posts.push({
      name: handle,
      handle,
      timestamp: formatPostTimestamp(date),
      text: trimSnippet(row.headline, 170),
      language: (row.language || "en").trim() || "en",
      sentiment: bucket,
      likes,
      shares: 0,
      comments: 0,
      views: 0,
      url: postUrl,
      engagement: likes,
    });
  }

  const meta = PLATFORM_META.facebook;
  return {
    platform: "facebook",
    title: meta.title,
    dateRange: { start: toIsoDate(start), end: toIsoDate(end) },
    kpis: {
      totalMentions: filtered.length,
      uniqueSources: handles.size,
      totalEngagement,
      totalReach: 0,
      socialMentions: filtered.length,
      socialUsers: handles.size,
      webMentions: 0,
      webSites: 0,
    },
    dailyTimeline: buildDailyTimeline(dates, start, end),
    sentiment: sentimentSeries(sentiment),
    topEntities: buildTopEntities(handles),
    posts: posts
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 24)
      .map(({ engagement: _engagement, ...post }) => post),
    chartTypes: {
      timeline: "line",
      sentiment: "pie",
      engagement: null,
      ranking: "bar",
    },
    accentColor: meta.accentColor,
  };
}

const loaders: Record<PlatformKey, (filters?: ChartFilters) => PlatformChartPayload | Promise<PlatformChartPayload>> = {
  twitter: loadTwitterData,
  online: loadOnlineData,
  youtube: loadYouTubeData,
  instagram: loadInstagramData,
  facebook: loadFacebookData,
};

export async function getPlatformChartData(
  platform: PlatformKey,
  filters: ChartFilters = {}
): Promise<PlatformChartPayload> {
  return loaders[platform](filters);
}

export async function getAllPlatformChartData(
  filters: ChartFilters = {}
): Promise<PlatformChartPayload[]> {
  const platforms = Object.keys(loaders) as PlatformKey[];
  return Promise.all(platforms.map((platform) => getPlatformChartData(platform, filters)));
}



