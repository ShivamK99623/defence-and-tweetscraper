import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";


const REPORT_START = new Date("2026-06-25T00:00:00");
const REPORT_END = new Date("2026-07-12T23:59:59");
const DEFAULT_REPORT_TITLE = "Analytical Report on Operation Sindoor Controversy";

export type KeywordMode = "and" | "or";

/** Cross-media logical fields — mapped per platform column. */
export type SearchFieldKey =
  | "content"
  | "title"
  | "author"
  | "summary"
  | "url"
  | "tags";

export const ALL_SEARCH_FIELDS: SearchFieldKey[] = [
  "content",
  "title",
  "author",
  "summary",
  "url",
  "tags",
];

export interface ChartFilters {
  /** Comma-separated keywords (also used for single keyword). */
  keyword?: string;
  keywordMode?: KeywordMode;
  /** Fields to search; empty / omitted = all available fields. */
  searchFields?: SearchFieldKey[];
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  reportTitle?: string;
}

export type QueryType = "none" | "boolean" | "keyword_and" | "keyword_or";

export interface ChartMeta {
  reportTitle: string;
  keyword: string;
  keywordMode: KeywordMode;
  searchFields: SearchFieldKey[];
  dateRange: { start: string; end: string };
  /** How the keyword filter was interpreted for this request. */
  queryType: QueryType;
  /** Human-readable query type label. */
  queryTypeLabel: string;
  /** Normalized query expression actually applied. */
  generatedQuery: string;
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

function resolveKeywordMode(raw: string | undefined | null): KeywordMode {
  return String(raw ?? "").trim().toLowerCase() === "or" ? "or" : "and";
}

function parseSearchFields(raw: string | string[] | undefined | null): SearchFieldKey[] {
  const pieces = Array.isArray(raw)
    ? raw
    : String(raw ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
  const allowed = new Set<string>(ALL_SEARCH_FIELDS);
  const fields = pieces.filter((p): p is SearchFieldKey => allowed.has(p));
  return fields.length ? fields : [...ALL_SEARCH_FIELDS];
}

/** Split keywords: commas/semicolons, or quoted phrases; otherwise whitespace. */
export function parseKeywords(raw: string | undefined | null): string[] {
  const text = (raw ?? "").trim();
  if (!text) return [];
  const out: string[] = [];
  const re = /"([^"]+)"|'([^']+)'|([^,;]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const token = (m[1] ?? m[2] ?? m[3] ?? "").trim().toLowerCase();
    if (token) out.push(token);
  }
  return out;
}

type BoolNode =
  | { type: "term"; value: string }
  | { type: "and"; left: BoolNode; right: BoolNode }
  | { type: "or"; left: BoolNode; right: BoolNode };

type BoolToken =
  | { kind: "term"; value: string }
  | { kind: "and" }
  | { kind: "or" }
  | { kind: "lparen" }
  | { kind: "rparen" };

function looksLikeBooleanQuery(raw: string): boolean {
  return /[()]|\b(and|or)\b|&&|\|\|/.test(raw);
}

function tokenizeBooleanQuery(raw: string): BoolToken[] {
  const s = raw.trim();
  const tokens: BoolToken[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch) || ch === ",") {
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }
    if (s.startsWith("&&", i)) {
      tokens.push({ kind: "and" });
      i += 2;
      continue;
    }
    if (s.startsWith("||", i)) {
      tokens.push({ kind: "or" });
      i += 2;
      continue;
    }
    if (ch === "&") {
      tokens.push({ kind: "and" });
      i += 1;
      continue;
    }
    if (ch === "|") {
      tokens.push({ kind: "or" });
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      let value = "";
      while (i < s.length && s[i] !== quote) {
        value += s[i];
        i += 1;
      }
      if (i < s.length) i += 1; // closing quote
      const term = value.trim().toLowerCase();
      if (term) tokens.push({ kind: "term", value: term });
      continue;
    }

    let j = i;
    while (j < s.length && !/\s/.test(s[j]) && s[j] !== "(" && s[j] !== ")" && s[j] !== "," && s[j] !== "&" && s[j] !== "|") {
      j += 1;
    }
    const word = s.slice(i, j);
    i = j;
    const lower = word.toLowerCase();
    if (lower === "and") tokens.push({ kind: "and" });
    else if (lower === "or") tokens.push({ kind: "or" });
    else if (word.trim()) tokens.push({ kind: "term", value: lower });
  }
  return tokens;
}

function parseBooleanQuery(raw: string): BoolNode | null {
  const tokens = tokenizeBooleanQuery(raw);
  if (!tokens.length) return null;
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parsePrimary = (): BoolNode | null => {
    const t = peek();
    if (!t) return null;
    if (t.kind === "lparen") {
      consume();
      const inner = parseOr();
      if (peek()?.kind === "rparen") consume();
      return inner;
    }
    if (t.kind === "term") {
      consume();
      return { type: "term", value: t.value };
    }
    return null;
  };

  const parseAnd = (): BoolNode | null => {
    let left = parsePrimary();
    if (!left) return null;
    while (true) {
      const t = peek();
      if (!t) break;
      if (t.kind === "and") {
        consume();
        const right = parsePrimary();
        if (!right) break;
        left = { type: "and", left, right };
        continue;
      }
      // juxtaposition → AND  e.g. sindoor (controversy or deaths)
      if (t.kind === "term" || t.kind === "lparen") {
        const right = parsePrimary();
        if (!right) break;
        left = { type: "and", left, right };
        continue;
      }
      break;
    }
    return left;
  };

  const parseOr = (): BoolNode | null => {
    let left = parseAnd();
    if (!left) return null;
    while (peek()?.kind === "or") {
      consume();
      const right = parseAnd();
      if (!right) break;
      left = { type: "or", left, right };
    }
    return left;
  };

  try {
    const tree = parseOr();
    return tree;
  } catch {
    return null;
  }
}

function evalBooleanNode(node: BoolNode, hay: string): boolean {
  switch (node.type) {
    case "term":
      return hay.includes(node.value);
    case "and":
      return evalBooleanNode(node.left, hay) && evalBooleanNode(node.right, hay);
    case "or":
      return evalBooleanNode(node.left, hay) || evalBooleanNode(node.right, hay);
  }
}

type SearchFieldValues = Partial<Record<SearchFieldKey, string | undefined | null>>;

function buildSearchHaystack(
  filters: ChartFilters,
  fields: SearchFieldValues
): string | null {
  const selected = parseSearchFields(filters.searchFields);
  const parts = selected
    .map((key) => fields[key])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.toLowerCase());

  const haystackParts =
    parts.length > 0
      ? parts
      : Object.values(fields)
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.toLowerCase());

  if (!haystackParts.length) return null;
  return haystackParts.join(" \n ");
}

function matchesAdvancedSearch(
  filters: ChartFilters,
  fields: SearchFieldValues
): boolean {
  const raw = (filters.keyword ?? "").trim();
  if (!raw) return true;

  const hay = buildSearchHaystack(filters, fields);
  if (hay == null) return false;

  // Boolean query: sindoor and (controversy or deaths)
  if (looksLikeBooleanQuery(raw)) {
    const tree = parseBooleanQuery(raw);
    if (tree) return evalBooleanNode(tree, hay);
  }

  // Legacy: comma-separated keywords + AND/OR mode toggle
  const keywords = parseKeywords(raw);
  if (!keywords.length) return true;
  const mode = resolveKeywordMode(filters.keywordMode);
  return mode === "or"
    ? keywords.some((k) => hay.includes(k))
    : keywords.every((k) => hay.includes(k));
}

function resolveReportTitle(filters: ChartFilters = {}): string {
  const title = (filters.reportTitle ?? "").trim();
  return title || DEFAULT_REPORT_TITLE;
}

function describeGeneratedQuery(filters: ChartFilters = {}): {
  queryType: QueryType;
  queryTypeLabel: string;
  generatedQuery: string;
} {
  const raw = (filters.keyword ?? "").trim();
  if (!raw) {
    return {
      queryType: "none",
      queryTypeLabel: "No keyword filter",
      generatedQuery: "(all mentions in date range)",
    };
  }

  if (looksLikeBooleanQuery(raw)) {
    const tree = parseBooleanQuery(raw);
    if (tree) {
      return {
        queryType: "boolean",
        queryTypeLabel: "Boolean expression (AND / OR / groups)",
        generatedQuery: raw,
      };
    }
  }

  const keywords = parseKeywords(raw);
  const mode = resolveKeywordMode(filters.keywordMode);
  if (!keywords.length) {
    return {
      queryType: "none",
      queryTypeLabel: "No keyword filter",
      generatedQuery: "(all mentions in date range)",
    };
  }

  const joiner = mode === "or" ? " OR " : " AND ";
  const generatedQuery = keywords
    .map((k) => (k.includes(" ") ? `"${k}"` : k))
    .join(joiner);

  return {
    queryType: mode === "or" ? "keyword_or" : "keyword_and",
    queryTypeLabel:
      mode === "or"
        ? "Keyword list (OR — any term matches)"
        : "Keyword list (AND — all terms must match)",
    generatedQuery,
  };
}

export function buildChartMeta(filters: ChartFilters = {}): ChartMeta {
  const { start, end } = resolveFilterRange(filters);
  const q = describeGeneratedQuery(filters);
  return {
    reportTitle: resolveReportTitle(filters),
    keyword: (filters.keyword ?? "").trim(),
    keywordMode: resolveKeywordMode(filters.keywordMode),
    searchFields: parseSearchFields(filters.searchFields),
    dateRange: { start: toIsoDate(start), end: toIsoDate(end) },
    queryType: q.queryType,
    queryTypeLabel: q.queryTypeLabel,
    generatedQuery: q.generatedQuery,
  };
}

export function parseChartFiltersFromQuery(query: any): ChartFilters {
  const pick = (key: string) => {
    const v = query[key];
    if (Array.isArray(v)) return String(v[0] ?? "");
    return typeof v === "string" ? v : "";
  };
  const fieldsRaw = pick("searchFields") || pick("fields");
  return {
    keyword: pick("keyword") || undefined,
    keywordMode: resolveKeywordMode(pick("keywordMode") || pick("mode")),
    searchFields: parseSearchFields(fieldsRaw),
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
  /** Sum of post views in range (Twitter/X). */
  views: number | null;
  /** Sum of likes in range (YouTube / Instagram / Facebook). */
  likes: number | null;
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

export interface ActorGroupPosts {
  id: string;
  title: string;
  posts: PostItem[];
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
  /** Curated handle groups → top posts (Twitter/X only). */
  actorGroups?: ActorGroupPosts[];
  chartTypes: {
    timeline: "line";
    sentiment: "pie";
    engagement: "bar" | null;
    ranking: "bar";
  };
  accentColor: string;
}

const TWITTER_ACTOR_GROUPS: { id: string; title: string; handles: string[] }[] = [
  {
    id: "opposition",
    title: "The opposition & political machine",
    handles: [
      "Pawankhera",
      "INCIndia",
      "kcvenugopalmp",
      "SupriyaShrinate",
      "GauravGogoiAsm",
      "ManishTewari",
      "INCKerala",
      "sagarikaghose",
      "priyankac19",
    ],
  },
  {
    id: "celebrity",
    title: "Celebrity & influencer critics",
    handles: [
      "zoo_bear",
      "malpani",
      "MANJULtoons",
      "iamnarendranath",
      "ShayarImran",
      "Highonchoorma",
      "SushantSin",
      "manaman_chhina",
    ],
  },
  {
    id: "defence",
    title: "The defence: official machinery, allies and fact-checkers",
    handles: [
      "SpokespersonMoD",
      "PIB_India",
      "HQ_IDS_India",
      "amitmalviya",
      "ShivAroor",
      "MeghUpdates",
      "AshokShrivasta6",
      "pradip103",
      "Mrsinha",
      "yashwantcall4",
      "MythbusterXX",
      "BefittingFacts",
      "rkalia80",
      "priyankac19",
    ],
  },
  {
    id: "media",
    title: "Media conduct: who seeded the false frame",
    handles: [
      "IndiaToday",
      "ANI",
      "PTI_News",
      "news24tvchannel",
      "the_hindu",
      "trtworld",
      "ndtv",
      "IndianExpress",
      "CNNnews18",
      "WIONews",
      "htTweets",
      "ETNOWlive",
      "guwahatiplus",
    ],
  },
];

function normalizeHandleKey(handle: string): string {
  return handle.replace(/^@/, "").trim().toLowerCase();
}

function buildActorGroupPosts(
  posts: (PostItem & { engagement: number })[],
  limit = 24
): ActorGroupPosts[] {
  return TWITTER_ACTOR_GROUPS.map((group) => {
    const allowed = new Set(group.handles.map(normalizeHandleKey));
    const bestByHandle = new Map<string, PostItem & { engagement: number }>();
    for (const post of posts) {
      const key = normalizeHandleKey(post.handle);
      if (!allowed.has(key)) continue;
      const existing = bestByHandle.get(key);
      if (
        !existing ||
        post.engagement > existing.engagement ||
        (post.engagement === existing.engagement && post.views > existing.views)
      ) {
        bestByHandle.set(key, post);
      }
    }
    const groupPosts = [...bestByHandle.values()]
      .sort((a, b) => b.engagement - a.engagement || b.views - a.views)
      .slice(0, limit)
      .map(({ engagement: _engagement, ...post }) => post);
    return { id: group.id, title: group.title, posts: groupPosts };
  }).filter((g) => g.posts.length > 0);
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
  views: number;
  likes: number;
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
      views: item.views,
      likes: item.likes,
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
  extra?: {
    followers?: number | null;
    subLabel?: string;
    link?: string;
    views?: number;
    likes?: number;
  }
) {
  const existing = map.get(key) ?? {
    name: displayName,
    handle,
    mentions: 0,
    engagement: 0,
    followers: extra?.followers ?? null,
    views: 0,
    likes: 0,
    subLabel: extra?.subLabel,
    sentiment: { positive: 0, negative: 0, neutral: 0 },
    link: extra?.link ?? "",
  };
  existing.mentions += 1;
  existing.engagement += engagement;
  if (extra?.followers != null) existing.followers = extra.followers;
  if (extra?.views != null) existing.views += extra.views;
  if (extra?.likes != null) existing.likes += extra.likes;
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
  const raw = JSON.parse(fs.readFileSync(DATA_FILES.twitter, "utf8")) as TwitterRecord[];
  const filtered = raw.filter((item) => {
    const date = new Date(item.datetime);
    if (!inDateRange(date, start, end)) return false;
    return matchesAdvancedSearch(filters, {
      content: item.content,
      author: item.username,
      url: item.statusHref ? `https://x.com${item.statusHref}` : "",
    });
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

    const engagement = itemLikes + itemShares + itemComments;
    const handle = item.username.replace(/^@/, "");
    const postUrl = item.statusHref ? `https://x.com${item.statusHref}` : "";
    trackEntity(handles, handle, handle, `@${handle}`, engagement, bucket, {
      link: `https://x.com/${handle}`,
      views: itemViews,
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
    actorGroups: buildActorGroupPosts(posts),
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
  const rows = readCsv(DATA_FILES.online).filter((row) => {
    const date = parseDmyDate(row["Date & Time"]);
    if (!inDateRange(date, start, end)) return false;
    return matchesAdvancedSearch(filters, {
      title: row.Heading,
      summary: row.Summary,
      content: row.Content,
      author: [row.Publication, row.Authors].filter(Boolean).join(" "),
      url: row.Links,
    });
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
  const rows = readCsv(DATA_FILES.youtube).filter((row) => {
    const date = parseDmyDate(row["Date & Time"]);
    if (!inDateRange(date, start, end)) return false;
    return matchesAdvancedSearch(filters, {
      title: row.Headline,
      author: row.Channel,
      summary: row.Summary,
      content: row.Summary,
      url: row.Link,
    });
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
        likes: rowLikes,
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
  const rows = readCsv(DATA_FILES.instagram).filter((row) => {
    const date = parseDotDate(row.CreatedAt);
    if (!inDateRange(date, start, end)) return false;
    return matchesAdvancedSearch(filters, {
      author: row.Handle,
      title: row.Headline,
      content: [row.Caption, row.Content, row.Text].filter(Boolean).join(" "),
      summary: row.Caption,
      url: row.URL,
    });
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
      likes,
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
  const filtered = rows.filter((row) => {
    const date = parseFacebookDate(row.createdAt);
    if (!inDateRange(date, start, end)) return false;
    return matchesAdvancedSearch(filters, {
      title: row.headline,
      content: row.headline,
      author: row.handle,
      tags: row.tags,
      url: row.url,
    });
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
      likes,
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

/* ------------------------------------------------------------------ */
/* Executive summary (data-driven from news + social on martyrs row)   */
/* ------------------------------------------------------------------ */

export interface ExecutiveSummaryPayload {
  paragraph: string;
  bullets: { lead: string; body: string }[];
}

const EXEC_THEMES: {
  id: string;
  lead: string;
  body: string;
  pattern: RegExp;
}[] = [
  {
    id: "casualty_row",
    lead: "Operation Sindoor casualty / martyrs row:",
    body: " Coverage repeatedly contested how many Indian soldiers were martyred, including claims that confirmed martyr figures were inflated in hostile narratives.",
    pattern:
      /\b(martyr|shaheed|casualt|coffin|600|six soldiers?|6 soldiers?|soldier[s]? (killed|martyred)|honou?r.*martyr)\b/i,
  },
  {
    id: "political_attack",
    lead: "Political attack on casualty statements:",
    body: " Opposition parties and commentators pressed privilege motions and resignation demands against the Defence Minister over alleged misstatements on Operation Sindoor losses.",
    pattern:
      /\b(privilege motion|rajnath|defence minister|resign|congress|opposition|lie|mislead|monsoon session|all-?party)\b/i,
  },
  {
    id: "war_memorial",
    lead: "Tributes at the National War Memorial:",
    body: " A parallel stream honoured fallen soldiers at the National War Memorial, framing remembrance of martyrs as distinct from the partisan casualty controversy.",
    pattern:
      /\b(national war memorial|war memorial|tribute|fallen soldiers?|immortality|bravery|sacrifice|eternal flame)\b/i,
  },
  {
    id: "fact_check",
    lead: "Fact-checks of manipulated videos:",
    body: " Fact-checkers flagged AI-manipulated / deepfake clips that falsely attributed admissions of Operation Sindoor failure or losses to senior military leadership.",
    pattern:
      /\b(fact[- ]?check|AI[- ]?manipulat|deepfake|digitally altered|fake video|manipulated video|false(ly)? claim)\b/i,
  },
  {
    id: "ops_readiness",
    lead: "Forward messaging on readiness:",
    body: " Official and supportive coverage also highlighted preparedness themes such as Operation Sindoor 2.0 / follow-on contingencies and the primacy of trained soldiers over AI alone.",
    pattern:
      /\b(sindoor\s*2\.0|snow leopard|army chief|dwivedi|trained soldiers?|national resolve|prepare(dness)?)\b/i,
  },
  {
    id: "terror_camps",
    lead: "Counter-narrative on operational impact:",
    body: " Pro-operation voices stressed strikes on terror camps and rejected casualty-inflation claims as propaganda meant to dilute the martyrs’ sacrifice.",
    pattern:
      /\b(terror camp|terrorist (base|camp)|hit terror|destroyed|fake news|propaganda|cope)\b/i,
  },
];

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function collectExecutiveCorpus(filters: ChartFilters): string[] {
  return collectMentionDocs(filters).map((d) => d.text);
}

interface MentionDoc {
  text: string;
  url: string;
  engagement: number;
  views: number;
  sentiment: SentimentBucket;
}

function collectMentionDocs(filters: ChartFilters): MentionDoc[] {
  const { start, end } = resolveFilterRange(filters);
  const docs: MentionDoc[] = [];

  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILES.twitter, "utf8")) as TwitterRecord[];
    for (const item of raw) {
      const date = new Date(item.datetime);
      if (!inDateRange(date, start, end)) continue;
      if (
        !matchesAdvancedSearch(filters, {
          content: item.content,
          author: item.username,
          url: item.statusHref ? `https://x.com${item.statusHref}` : "",
        })
      ) {
        continue;
      }
      const stats = item.stats ?? {};
      const likes = stats.likes ?? 0;
      const shares = stats.reposts ?? 0;
      const comments = stats.replies ?? 0;
      const views = stats.views ?? 0;
      const url = item.statusHref ? `https://x.com${item.statusHref}` : "";
      if (!item.content) continue;
      docs.push({
        text: item.content,
        url,
        engagement: likes + shares + comments,
        views,
        sentiment: inferTwitterSentiment(item.content),
      });
    }
  } catch {
    /* skip twitter */
  }

  try {
    for (const row of readCsv(DATA_FILES.online)) {
      const date = parseDmyDate(row["Date & Time"]);
      if (!inDateRange(date, start, end)) continue;
      if (
        !matchesAdvancedSearch(filters, {
          title: row.Heading,
          summary: row.Summary,
          content: row.Content,
          author: [row.Publication, row.Authors].filter(Boolean).join(" "),
          url: row.Links,
        })
      ) {
        continue;
      }
      const text = [row.Heading, row.Summary, row.Content].filter(Boolean).join(" ");
      const url = parseFirstUrl(row.Links);
      if (!text) continue;
      docs.push({
        text,
        url,
        engagement: 1,
        views: 0,
        sentiment: normalizeSentiment(row.Sentiment),
      });
    }
  } catch {
    /* skip online */
  }

  try {
    for (const row of readCsv(DATA_FILES.youtube)) {
      const date = parseDmyDate(row["Date & Time"]);
      if (!inDateRange(date, start, end)) continue;
      if (
        !matchesAdvancedSearch(filters, {
          title: row.Headline,
          author: row.Channel,
          summary: row.Summary,
          content: row.Summary,
          url: row.Link,
        })
      ) {
        continue;
      }
      const text = [row.Headline, row.Summary].filter(Boolean).join(" ");
      const url = sanitizeHttpUrl(row.Link);
      const likes = parseEngagementNumber(row.Likes);
      const comments = parseEngagementNumber(row.Comments);
      if (!text) continue;
      docs.push({
        text,
        url,
        engagement: likes + comments,
        views: 0,
        sentiment: normalizeSentiment(row.Semetiment ?? row.Sentiment),
      });
    }
  } catch {
    /* skip youtube */
  }

  return docs;
}

function formatCompactCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "–";
  if (value >= 1_000_000) {
    const n = value / 1_000_000;
    return `${n >= 10 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    const n = value / 1_000;
    return `${n >= 10 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(Math.round(value));
}

export interface TrendingTopicItem {
  cluster: string;
  url: string;
  mentions: string;
  reach: string;
  engagement: string;
  mix: { positive: number; negative: number; neutral: number };
}

export function buildTrendingTopics(
  filters: ChartFilters = {},
  limit = 5
): TrendingTopicItem[] {
  const docs = collectMentionDocs(filters);
  const withUrl = docs.filter((d) => /^https?:\/\//i.test((d.url ?? "").trim()));

  type ThemeAgg = {
    matched: MentionDoc[];
    engagement: number;
    reach: number;
    buckets: { positive: number; negative: number; neutral: number };
  };

  const aggs: ThemeAgg[] = EXEC_THEMES.map((theme) => {
    const matched = withUrl.filter((d) => theme.pattern.test(d.text));
    if (!matched.length) return null;
    const buckets = { positive: 0, negative: 0, neutral: 0 };
    let engagement = 0;
    let reach = 0;
    for (const d of matched) {
      buckets[d.sentiment] += 1;
      engagement += d.engagement;
      reach += d.views;
    }
    return { matched, engagement, reach, buckets };
  }).filter((a): a is ThemeAgg => Boolean(a));

  aggs.sort((a, b) => b.matched.length - a.matched.length);

  const usedUrls = new Set<string>();
  const rows: TrendingTopicItem[] = [];

  for (const agg of aggs) {
    if (rows.length >= limit) break;
    const ranked = [...agg.matched].sort(
      (a, b) => b.engagement - a.engagement || b.views - a.views
    );
    const best = ranked.find((d) => !usedUrls.has(d.url.trim())) ?? ranked[0];
    if (!best?.url) continue;
    const url = best.url.trim();
    if (usedUrls.has(url)) continue;
    usedUrls.add(url);

    const total =
      agg.buckets.positive + agg.buckets.negative + agg.buckets.neutral || 1;
    rows.push({
      cluster: trimSnippet(best.text.replace(/\s+/g, " ").trim(), 220),
      url,
      mentions: String(agg.matched.length),
      reach: formatCompactCount(agg.reach),
      engagement: formatCompactCount(agg.engagement),
      mix: {
        positive: Math.round((agg.buckets.positive / total) * 100),
        negative: Math.round((agg.buckets.negative / total) * 100),
        neutral: Math.round((agg.buckets.neutral / total) * 100),
      },
    });
  }

  if (rows.length >= limit) return rows;

  const fillers = [...withUrl]
    .filter((d) => !usedUrls.has(d.url.trim()))
    .sort((a, b) => b.engagement - a.engagement || b.views - a.views)
    .slice(0, limit - rows.length)
    .map((d) => {
      const mix =
        d.sentiment === "positive"
          ? { positive: 100, negative: 0, neutral: 0 }
          : d.sentiment === "negative"
            ? { positive: 0, negative: 100, neutral: 0 }
            : { positive: 0, negative: 0, neutral: 100 };
      return {
        cluster: trimSnippet(d.text.replace(/\s+/g, " ").trim(), 220),
        url: d.url.trim(),
        mentions: "1",
        reach: formatCompactCount(d.views),
        engagement: formatCompactCount(d.engagement),
        mix,
      } satisfies TrendingTopicItem;
    });

  return [...rows, ...fillers].slice(0, limit);
}

export function buildExecutiveSummary(
  filters: ChartFilters = {},
  platforms: PlatformChartPayload[] = []
): ExecutiveSummaryPayload {
  const { start, end } = resolveFilterRange(filters);
  const rangeLabel = `${formatShortDate(toIsoDate(start))} – ${formatShortDate(toIsoDate(end))}`;

  const totalMentions = platforms.reduce((sum, p) => sum + (p.kpis?.totalMentions ?? 0), 0);
  const totalEngagement = platforms.reduce((sum, p) => sum + (p.kpis?.totalEngagement ?? 0), 0);
  const totalReach = platforms.reduce((sum, p) => sum + (p.kpis?.totalReach ?? 0), 0);

  const sentiment = { positive: 0, negative: 0, neutral: 0 };
  for (const p of platforms) {
    for (const s of p.sentiment ?? []) {
      const key = s.name.toLowerCase() as SentimentBucket;
      if (key in sentiment) sentiment[key] += s.value;
    }
  }
  const sentTotal = sentiment.positive + sentiment.negative + sentiment.neutral || 1;
  const posPct = Math.round((sentiment.positive / sentTotal) * 100);
  const negPct = Math.round((sentiment.negative / sentTotal) * 100);
  const neuPct = Math.max(0, 100 - posPct - negPct);
  const dominant =
    sentiment.positive >= sentiment.negative && sentiment.positive >= sentiment.neutral
      ? "positive"
      : sentiment.negative >= sentiment.neutral
        ? "negative"
        : "neutral";

  const corpus = collectExecutiveCorpus(filters);
  const themeHits = EXEC_THEMES.map((theme) => {
    let count = 0;
    for (const text of corpus) {
      if (theme.pattern.test(text)) count += 1;
    }
    return { ...theme, count };
  })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const platformBits = platforms
    .filter((p) => (p.kpis?.totalMentions ?? 0) > 0)
    .map((p) => {
      const label =
        p.platform === "twitter"
          ? "X"
          : p.platform === "online"
            ? "web"
            : p.platform === "youtube"
              ? "YouTube"
              : p.platform === "instagram"
                ? "Instagram"
                : "Facebook";
      return `${label} (${p.kpis.totalMentions.toLocaleString("en-IN")})`;
    })
    .join(", ");

  const topThemeLine =
    themeHits.length > 0
      ? `The sharpest clusters were ${themeHits
          .slice(0, 3)
          .map((t) => t.lead.replace(/:$/, "").toLowerCase())
          .join("; ")}.`
      : "Discourse mixed tributes to fallen soldiers with contested claims about Operation Sindoor losses.";

  const paragraph =
    `Between ${rangeLabel}, SAMVAD tracked ${totalMentions.toLocaleString("en-IN")} mentions` +
    (platformBits ? ` across ${platformBits}` : "") +
    ` on the Operation Sindoor controversy — especially narratives around martyrs, casualty figures, and how those deaths were framed online and in news.` +
    ` Combined engagement reached ${totalEngagement.toLocaleString("en-IN")}` +
    (totalReach > 0 ? ` with about ${totalReach.toLocaleString("en-IN")} measured views/reach on X` : "") +
    `. Overall tone tilted ${dominant} (${posPct}% positive, ${negPct}% negative, ${neuPct}% neutral). ${topThemeLine}`;

  const bullets: { lead: string; body: string }[] = themeHits.slice(0, 5).map((t) => ({
    lead: t.lead,
    body: `${t.body} (~${t.count.toLocaleString("en-IN")} matching items in the scanned corpus.)`,
  }));

  if (bullets.length < 5) {
    bullets.push({
      lead: "Cross-platform diffusion:",
      body: ` The same martyr-/casualty-framed arguments travelled across news sites, X threads, and video platforms, amplifying both tribute content and controversy claims.`,
    });
  }
  if (bullets.length < 5) {
    bullets.push({
      lead: "Sentiment split:",
      body: ` Positive posts clustered around remembrance and operational defence; negative posts clustered around alleged misstatements and inflated casualty narratives.`,
    });
  }

  return {
    paragraph,
    bullets: bullets.slice(0, 6),
  };
}



