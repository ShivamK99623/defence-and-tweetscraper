import fs from "fs";
import path from "path";


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
  /**
   * Comma-separated terms to exclude — any match removes the row
   * (searched in the same selected fields as `keyword`).
   */
  excludeKeyword?: string;
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
  excludeKeyword: string;
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

/** Normalize text for case-insensitive search (curly quotes, NBSP, etc.). */
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B`]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ");
}

/** Remove one layer of wrapping single/double quotes from a parsed token. */
function stripWrappingQuotes(token: string): string {
  let t = token.trim();
  // Peel nested/smart-quote layers after normalization.
  for (let i = 0; i < 3 && t.length >= 2; i += 1) {
    const first = t[0];
    const last = t[t.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      t = t.slice(1, -1).trim();
      continue;
    }
    break;
  }
  return t;
}

/**
 * Split a keyword / exclude string into terms.
 * Supports commas, semicolons, and "quoted phrases" / 'quoted phrases'
 * (including curly/smart quotes from paste).
 */
export function parseKeywords(raw: string | undefined | null): string[] {
  // Normalize first so smart quotes become ASCII and phrase regex matches.
  const text = normalizeForSearch(raw ?? "").trim();
  if (!text) return [];
  const out: string[] = [];
  const re = /"([^"]+)"|'([^']+)'|([^,;]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const token = stripWrappingQuotes((m[1] ?? m[2] ?? m[3] ?? "").trim());
    if (token) out.push(token);
  }
  return out;
}

/**
 * If the user pastes `… Exclude: a, b` into the Keywords box (or uses
 * `NOT:` / `-exclude:`), split that into include + exclude parts.
 */
export function splitIncludeExcludeRaw(raw: string | undefined | null): {
  keyword: string;
  excludeKeyword: string;
} {
  const text = (raw ?? "").trim();
  if (!text) return { keyword: "", excludeKeyword: "" };

  const splitRe = /\b(?:exclude|not|excluding)\s*:\s*/i;
  const m = splitRe.exec(text);
  if (!m || m.index < 0) {
    return { keyword: text, excludeKeyword: "" };
  }
  const keyword = text.slice(0, m.index).trim();
  const excludeKeyword = text.slice(m.index + m[0].length).trim();
  return { keyword, excludeKeyword };
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
      const term = normalizeForSearch(value.trim());
      if (term) tokens.push({ kind: "term", value: term });
      continue;
    }

    let j = i;
    while (j < s.length && !/\s/.test(s[j]) && s[j] !== "(" && s[j] !== ")" && s[j] !== "," && s[j] !== "&" && s[j] !== "|") {
      j += 1;
    }
    const word = s.slice(i, j);
    i = j;
    const lower = normalizeForSearch(word);
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
    .map((v) => normalizeForSearch(v));

  const haystackParts =
    parts.length > 0
      ? parts
      : Object.values(fields)
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => normalizeForSearch(v));

  if (!haystackParts.length) return null;
  return haystackParts.join(" \n ");
}

function formatKeywordList(terms: string[], joiner: string): string {
  return terms.map((k) => (k.includes(" ") ? `"${k}"` : k)).join(joiner);
}

function matchesIncludeKeywords(
  filters: ChartFilters,
  hay: string
): boolean {
  const raw = (filters.keyword ?? "").trim();
  if (!raw) return true;

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

/** True when the row must be dropped because an exclude term appears. */
function matchesExcludeKeywords(
  filters: ChartFilters,
  hay: string
): boolean {
  const excluded = parseKeywords(filters.excludeKeyword);
  if (!excluded.length) return false;
  return excluded.some((k) => {
    if (!k) return false;
    if (hay.includes(k)) return true;
    // `@handle` also matches the bare handle (author / mention variants).
    if (k.startsWith("@") && k.length > 1 && hay.includes(k.slice(1))) return true;
    return false;
  });
}

function matchesAdvancedSearch(
  filters: ChartFilters,
  fields: SearchFieldValues
): boolean {
  const hasInclude = Boolean((filters.keyword ?? "").trim());
  const hasExclude = parseKeywords(filters.excludeKeyword).length > 0;
  if (!hasInclude && !hasExclude) return true;

  const hay = buildSearchHaystack(filters, fields);
  // No searchable text: fail include filters; pass exclude-only filters.
  if (hay == null) return !hasInclude;

  if (hasInclude && !matchesIncludeKeywords(filters, hay)) return false;
  if (matchesExcludeKeywords(filters, hay)) return false;
  return true;
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
  const excluded = parseKeywords(filters.excludeKeyword);
  const excludeClause =
    excluded.length > 0
      ? ` NOT (${formatKeywordList(excluded, " OR ")})`
      : "";

  if (!raw) {
    if (excluded.length) {
      return {
        queryType: "none",
        queryTypeLabel: "Exclude keywords only",
        generatedQuery: `(all mentions in date range)${excludeClause}`,
      };
    }
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
        queryTypeLabel: excluded.length
          ? "Boolean expression + exclude keywords"
          : "Boolean expression (AND / OR / groups)",
        generatedQuery: `${raw}${excludeClause}`,
      };
    }
  }

  const keywords = parseKeywords(raw);
  const mode = resolveKeywordMode(filters.keywordMode);
  if (!keywords.length) {
    if (excluded.length) {
      return {
        queryType: "none",
        queryTypeLabel: "Exclude keywords only",
        generatedQuery: `(all mentions in date range)${excludeClause}`,
      };
    }
    return {
      queryType: "none",
      queryTypeLabel: "No keyword filter",
      generatedQuery: "(all mentions in date range)",
    };
  }

  const joiner = mode === "or" ? " OR " : " AND ";
  const generatedQuery = `${formatKeywordList(keywords, joiner)}${excludeClause}`;

  return {
    queryType: mode === "or" ? "keyword_or" : "keyword_and",
    queryTypeLabel:
      mode === "or"
        ? excluded.length
          ? "Keyword list (OR) + exclude"
          : "Keyword list (OR — any term matches)"
        : excluded.length
          ? "Keyword list (AND) + exclude"
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
    excludeKeyword: (filters.excludeKeyword ?? "").trim(),
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
  const rawKeyword = pick("keyword") || "";
  const rawExclude =
    pick("excludeKeyword") || pick("exclude") || pick("notKeyword") || "";

  // Support pasting `… Exclude: terms` into the Keywords box.
  const split = splitIncludeExcludeRaw(rawKeyword);
  const excludeKeyword = [rawExclude, split.excludeKeyword]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  return {
    keyword: (split.excludeKeyword ? split.keyword : rawKeyword) || undefined,
    excludeKeyword: excludeKeyword || undefined,
    keywordMode: resolveKeywordMode(pick("keywordMode") || pick("mode")),
    searchFields: parseSearchFields(fieldsRaw),
    startDate: pick("startDate") || undefined,
    endDate: pick("endDate") || undefined,
    reportTitle: pick("reportTitle") || undefined,
  };
}


const DATA_FILES = {
  twitter: path.join("reports/twitter/twitter.csv"),
  online: path.join("reports/digital.csv"),
  youtube: path.join("reports/youtube.csv"),
  instagram: path.join("reports/Op Sindoor_Insta_25jun_to_12july.csv"),
  facebook: path.join("reports/facebook.csv"),
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
    /** Sum of post views (Twitter/X only). */
    totalViews?: number;
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

/** Manual follower counts keyed by normalized handle / channel / page name. */
const INSTAGRAM_FOLLOWERS: Record<string, string> = {
  cjp_madhya_pradeshmp13: "11.4K",
  bharatdecoded27: "2133",
  sanjaydekaflj: "10.3K",
  thelikeindia: "46K",
  newssense_daily: "5804",
  swaybharat: "6915",
  "spot.newsmedia": "112K",
  "political_.mirror": "1628",
  realtalksbymomen_: "1059",
  thesachtalk: "24.4K",
  indiansgag: "925K",
  "the.vital.feed": "4227",
  "navikrag.mudde": "938",
  hlworld_official: "4665",
  acp_fact: "9969",
  factexpress1268: "2423",
  thebharatpost_: "1M",
  qequickexplained: "1565",
  firstpost: "3M",
  bslensinsta: "1125",
  rajusinghfacts: "578",
  indians_duniya: "38.9K",
  edgenewsin: "196K",
  drsti_kone: "14.7K",
};

const YOUTUBE_FOLLOWERS: Record<string, string> = {
  "ankit inspire india": "5.92M",
  "abhisar sharma": "10M",
  "politics broadcast": "416K",
  "ravish kumar official": "14.7M",
  "online news india": "7.84M",
  "indian express hindi": "471K",
  "kumkum binwal": "1.57M",
  "bbc news hindi": "21.8M",
  "the public india": "16M",
  "satya hindi": "3.71M",
  "news pinch": "1.61M",
  "news 24": "27.2M",
  "article19 india": "4.58M",
  "hw news english": "1.84M",
  "4pm": "8.59M",
  "live hindustan": "13.4M",
  "indian youth congress": "3.06M",
  "public meter": "3.33M",
  "paurush sharma": "1.69M",
  "the rajneeti": "3.2M",
  "bolta hindustan": "925K",
  "aam aadmi party": "7.54M",
  "lokmat hindi": "3.79M",
  deshkaal: "72K",
};

const FACEBOOK_FOLLOWERS: Record<string, string> = {
  "vipin saroha": "256K",
  "all india radio news": "4.9M",
  opindia: "428K",
  "zee news english": "17M",
  "dna india": "2.5M",
  "the hindu": "5.4M",
  "first post": "4M",
  "the economic times": "4.8M",
  mythbuster: "1.8K",
  "indian air force police": "1.3K",
  scoopwhoop: "4.5M",
  deshneeti: "509K",
  "online news": "4.4M",
  "aj news pulse": "37K",
  "unlock the mind": "4.1M",
  "local news of india": "841K",
  "jaano junction": "4.4K",
  "zee odisha": "519K",
  "indian express": "7.7M",
  news18: "7.2M",
  "report card": "8.3K",
  "aayushi dubey": "11K",
  "viral news reaction": "4.8K",
  "republic bharat": "10M",
};

function lookupFollowers(
  map: Record<string, string>,
  key: string
): number | null {
  const normalized = key.replace(/^@/, "").trim().toLowerCase();
  if (!normalized) return null;
  const raw = map[normalized];
  if (raw == null) return null;
  const value = parseEngagementNumber(raw);
  return value > 0 ? value : null;
}

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

/** Sum unique-entity follower counts (nulls ignored). Used as Social Reach for IG/YT/FB. */
function sumEntityFollowers(map: Map<string, EntityAccumulator>): number {
  let total = 0;
  for (const entity of map.values()) {
    if (entity.followers != null && entity.followers > 0) {
      total += entity.followers;
    }
  }
  return total;
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
  if (extra?.followers != null) {
    existing.followers =
      existing.followers != null
        ? Math.max(existing.followers, extra.followers)
        : extra.followers;
  }
  if (extra?.views != null) existing.views += extra.views;
  if (extra?.likes != null) existing.likes += extra.likes;
  if (extra?.subLabel && !existing.subLabel) existing.subLabel = extra.subLabel;
  if (extra?.link && !existing.link) existing.link = extra.link;
  existing.sentiment[sentiment] += 1;
  map.set(key, existing);
}

/** Shared date parser for unified media CSVs (twitter / digital / youtube / facebook). */
function parseUnifiedCsvDate(row: Record<string, string>): Date | null {
  const date = (row.date ?? "").trim();
  if (!date) return null;
  const time = (row.time ?? "12:00").trim() || "12:00";
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const parseTwitterCsvDate = parseUnifiedCsvDate;

function parseStanceScore(raw: string | undefined | null): SentimentBucket | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function resolveUnifiedSentiment(row: Record<string, string>): SentimentBucket {
  return (
    parseStanceScore(row.stance) ??
    inferTwitterSentiment([row.text, row.title, row.summary].filter(Boolean).join(" "))
  );
}

const resolveTwitterSentiment = resolveUnifiedSentiment;

function mediaPostImage(row: Record<string, string>): string {
  return sanitizeHttpUrl(row.media_url) || "";
}

const twitterPostImage = mediaPostImage;

/** Views column, or reach_claimed_est when exporters put views there. */
function unifiedRowViews(row: Record<string, string>): number {
  const views = parseEngagementNumber(row.views);
  if (views > 0) return views;
  return parseEngagementNumber(row.reach_claimed_est);
}

/** True reposts only — CSV often copies `views` into `shares` / `engagement_total`. */
function twitterShareCount(row: Record<string, string>): number {
  const reposts = parseEngagementNumber(row.reposts);
  if (reposts > 0) return reposts;

  const shares = parseEngagementNumber(row.shares);
  const views = parseEngagementNumber(row.views);
  // Treat shares as polluted when it matches views (common exporter bug).
  if (shares > 0 && !(views > 0 && shares === views)) return shares;
  return 0;
}

function componentEngagement(row: Record<string, string>): number {
  return (
    parseEngagementNumber(row.likes) +
    parseEngagementNumber(row.comments) +
    twitterShareCount(row)
  );
}

function twitterEngagement(row: Record<string, string>): number {
  const calculated = componentEngagement(row);
  const sheetTotal = parseEngagementNumber(row.engagement_total);
  const views = parseEngagementNumber(row.views);
  // Prefer component sum; only trust sheet total when it is not a views copy.
  if (sheetTotal > 0 && !(views > 0 && sheetTotal === views) && sheetTotal >= calculated) {
    return sheetTotal;
  }
  return calculated;
}

/** Non-Twitter media: components first, else engagement_total. */
function unifiedEngagement(row: Record<string, string>): number {
  const calculated = componentEngagement(row);
  if (calculated > 0) return calculated;
  return parseEngagementNumber(row.engagement_total);
}

function matchesUnifiedMediaSearch(
  filters: ChartFilters,
  row: Record<string, string>
): boolean {
  return matchesAdvancedSearch(filters, {
    content: row.text,
    title: row.title,
    author: [row.author, row.author_display_name, row.author_identity]
      .filter(Boolean)
      .join(" "),
    summary: row.summary,
    url: row.url,
  });
}

function buildEngagementBreakdown(
  likes: number,
  shares: number,
  comments: number
): { name: string; value: number }[] {
  const parts: { name: string; value: number }[] = [];
  if (likes > 0) parts.push({ name: "Likes", value: likes });
  if (shares > 0) parts.push({ name: "Shares", value: shares });
  if (comments > 0) parts.push({ name: "Comments", value: comments });
  return parts;
}

function loadTwitterData(filters: ChartFilters = {}): PlatformChartPayload {
  const { start, end } = resolveFilterRange(filters);
  const filtered = readCsv(DATA_FILES.twitter).filter((row) => {
    const date = parseTwitterCsvDate(row);
    if (!inDateRange(date, start, end)) return false;
    return matchesAdvancedSearch(filters, {
      content: row.text,
      title: row.title,
      author: [row.author, row.author_display_name, row.author_identity]
        .filter(Boolean)
        .join(" "),
      summary: row.summary,
      url: row.url,
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

  for (const row of filtered) {
    const date = parseTwitterCsvDate(row);
    if (date) dates.push(date);

    const handle = (row.author ?? "").replace(/^@/, "").trim();
    if (!handle) continue;
    users.add(handle);

    const bucket = resolveTwitterSentiment(row);
    sentiment[bucket] += 1;

    const itemLikes = parseEngagementNumber(row.likes);
    const itemShares = twitterShareCount(row);
    const itemComments = parseEngagementNumber(row.comments);
    const itemViews = parseEngagementNumber(row.views);
    const engagement = twitterEngagement(row);
    const followers = parseEngagementNumber(row.author_followers);
    const displayName = (row.author_display_name ?? "").trim() || handle;
    const postUrl = sanitizeHttpUrl(row.url);
    const subLabel = [row.author_category, row.author_identity]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(" · ");

    likes += itemLikes;
    shares += itemShares;
    comments += itemComments;
    views += itemViews;

    trackEntity(handles, handle, displayName, `@${handle}`, engagement, bucket, {
      link: `https://x.com/${encodeURIComponent(handle)}`,
      followers: followers > 0 ? followers : null,
      subLabel: subLabel || undefined,
      views: itemViews,
      likes: itemLikes,
    });

    posts.push({
      name: displayName,
      handle: `@${handle}`,
      timestamp: formatPostTimestamp(date),
      text: trimSnippet(row.text || row.title || "", 170),
      language: (row.language || "en").trim() || "en",
      sentiment: bucket,
      likes: itemLikes,
      shares: itemShares,
      comments: itemComments,
      views: itemViews,
      url: postUrl,
      image: twitterPostImage(row),
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
      totalReach: sumEntityFollowers(handles),
      totalViews: views,
      socialMentions: filtered.length,
      socialUsers: users.size,
      webMentions: 0,
      webSites: 0,
    },
    dailyTimeline: buildDailyTimeline(dates, start, end),
    sentiment: sentimentSeries(sentiment),
    engagementBreakdown: buildEngagementBreakdown(likes, shares, comments),
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
    const date = parseUnifiedCsvDate(row);
    if (!inDateRange(date, start, end)) return false;
    return matchesUnifiedMediaSearch(filters, row);
  });

  const sentiment: Record<SentimentBucket, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  const publications = new Map<string, EntityAccumulator>();
  const dates: Date[] = [];
  let totalReach = 0;
  let totalEngagement = 0;
  const articles: (ArticleItem & { sortDate: number; engagement: number })[] = [];

  for (const row of rows) {
    const date = parseUnifiedCsvDate(row);
    if (date) dates.push(date);
    const bucket = resolveUnifiedSentiment(row);
    sentiment[bucket] += 1;

    const articleUrl = parseFirstUrl(row.url);
    const domain =
      extractDomain(articleUrl) ||
      (row.author ?? "").trim() ||
      "Unknown";
    const publicationName =
      (row.author_display_name ?? "").trim() ||
      (row.author ?? "").trim() ||
      domain;
    const engagement = unifiedEngagement(row);
    const reach = unifiedRowViews(row);
    totalReach += reach;
    totalEngagement += engagement;

    trackEntity(publications, domain.toLowerCase(), domain, domain, engagement || 1, bucket, {
      subLabel: publicationName !== domain ? publicationName : undefined,
      link: articleUrl,
      views: reach,
      followers: parseEngagementNumber(row.author_followers) || null,
    });

    articles.push({
      domain,
      title: trimSnippet(row.title, 80),
      snippet: trimSnippet(row.summary || row.text, 90),
      timestamp: formatPostTimestamp(date),
      language: (row.language?.trim().slice(0, 2) || "en").toLowerCase(),
      sentiment: bucket,
      rankLabel: "N/A",
      tag: (row.type || "news").trim() || "news",
      url: articleUrl,
      sortDate: date ? date.getTime() : 0,
      engagement,
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
      totalEngagement,
      totalReach,
      totalViews: totalReach,
      socialMentions: 0,
      socialUsers: 0,
      webMentions: rows.length,
      webSites: publications.size,
    },
    dailyTimeline: buildDailyTimeline(dates, start, end),
    sentiment: sentimentSeries(sentiment),
    topEntities: buildTopEntities(publications, 24, "mentions"),
    articles: articles
      .sort((a, b) => b.engagement - a.engagement || b.sortDate - a.sortDate)
      .slice(0, 24)
      .map(({ sortDate: _sortDate, engagement: _engagement, ...article }) => article),
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
    const date = parseUnifiedCsvDate(row);
    if (!inDateRange(date, start, end)) return false;
    return matchesUnifiedMediaSearch(filters, row);
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
  let shares = 0;
  let totalEngagement = 0;
  let totalViews = 0;
  const videos: (VideoItem & { engagement: number })[] = [];

  for (const row of rows) {
    const date = parseUnifiedCsvDate(row);
    if (date) dates.push(date);
    const bucket = resolveUnifiedSentiment(row);
    sentiment[bucket] += 1;

    const rowLikes = parseEngagementNumber(row.likes);
    const rowComments = parseEngagementNumber(row.comments);
    const rowShares = twitterShareCount(row);
    const engagement = unifiedEngagement(row);
    const views = unifiedRowViews(row);
    // Sheet often only fills engagement_total — surface that as likes for KPI/cards.
    const displayLikes = rowLikes > 0 ? rowLikes : engagement;

    likes += displayLikes;
    comments += rowComments;
    shares += rowShares;
    totalEngagement += engagement;
    totalViews += views;

    const videoUrl = sanitizeHttpUrl(row.url);
    const channel = (row.author ?? "").trim() || "Unknown";
    const followers =
      parseEngagementNumber(row.author_followers) ||
      lookupFollowers(YOUTUBE_FOLLOWERS, channel);

    trackEntity(channels, channel.toLowerCase(), channel, channel, engagement, bucket, {
      link: videoUrl,
      likes: displayLikes,
      views,
      followers,
    });

    videos.push({
      channel,
      title: trimSnippet(row.title, 80),
      snippet: trimSnippet(row.summary || row.text, 90),
      timestamp: formatPostTimestamp(date),
      language: (row.language?.trim().slice(0, 2) || "en").toLowerCase(),
      sentiment: bucket,
      likes: displayLikes,
      comments: rowComments,
      views,
      url: videoUrl,
      engagement,
    });
  }

  const meta = PLATFORM_META.youtube;
  const followerReach = sumEntityFollowers(channels);
  return {
    platform: "youtube",
    title: meta.title,
    dateRange: { start: toIsoDate(start), end: toIsoDate(end) },
    kpis: {
      totalMentions: rows.length,
      uniqueSources: channels.size,
      totalEngagement,
      // Prefer follower reach when available; else video views from the sheet.
      totalReach: followerReach > 0 ? followerReach : totalViews,
      totalViews,
      socialMentions: rows.length,
      socialUsers: channels.size,
      webMentions: 0,
      webSites: 0,
    },
    dailyTimeline: buildDailyTimeline(dates, start, end),
    sentiment: sentimentSeries(sentiment),
    engagementBreakdown: buildEngagementBreakdown(likes, shares, comments),
    topEntities: buildTopEntities(channels),
    videos: videos
      .sort((a, b) => b.engagement - a.engagement || b.views - a.views)
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
  let likes = 0;
  let totalEngagement = 0;
  const posts: (PostItem & { engagement: number })[] = [];

  for (const row of rows) {
    const date = parseDotDate(row.CreatedAt);
    if (date) dates.push(date);
    const bucket = normalizeSentiment(row.Sentiment);
    sentiment[bucket] += 1;

    const itemLikes = parseEngagementNumber(row.Likes);
    const sheetEngagement = parseEngagementNumber(row.Engagement);
    // Prefer likes; sheet "Engagement" is inconsistently reach vs interactions.
    const engagement = itemLikes > 0 ? itemLikes : sheetEngagement;
    likes += engagement;
    totalEngagement += engagement;

    const handle = (row.Handle ?? "").replace(/\s+/g, " ").trim() || "Unknown";
    const handleKey = handle.replace(/^@/, "").toLowerCase();
    const postUrl = sanitizeHttpUrl(row.URL);
    const profileUrl = handleKey
      ? `https://www.instagram.com/${encodeURIComponent(handleKey)}/`
      : "";

    trackEntity(handles, handleKey, handle, `@${handle.replace(/^@/, "")}`, engagement, bucket, {
      link: profileUrl || postUrl,
      likes: itemLikes,
      followers: lookupFollowers(INSTAGRAM_FOLLOWERS, handleKey),
    });

    posts.push({
      name: handle.replace(/^@/, ""),
      handle: `@${handle.replace(/^@/, "")}`,
      timestamp: formatPostTimestamp(date),
      text: trimSnippet(row.Headline || row.Caption || row.Content || "", 170),
      language: (row.Language || "en").trim() || "en",
      sentiment: bucket,
      likes: itemLikes,
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
      totalReach: sumEntityFollowers(handles),
      socialMentions: rows.length,
      socialUsers: handles.size,
      webMentions: 0,
      webSites: 0,
    },
    dailyTimeline: buildDailyTimeline(dates, start, end),
    sentiment: sentimentSeries(sentiment),
    engagementBreakdown: buildEngagementBreakdown(likes, 0, 0),
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

function loadFacebookData(filters: ChartFilters = {}): PlatformChartPayload {
  const { start, end } = resolveFilterRange(filters);
  const filtered = readCsv(DATA_FILES.facebook).filter((row) => {
    const date = parseUnifiedCsvDate(row);
    if (!inDateRange(date, start, end)) return false;
    return matchesUnifiedMediaSearch(filters, row);
  });

  const sentiment: Record<SentimentBucket, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  const handles = new Map<string, EntityAccumulator>();
  const dates: Date[] = [];
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let totalEngagement = 0;
  const posts: (PostItem & { engagement: number })[] = [];

  for (const row of filtered) {
    const date = parseUnifiedCsvDate(row);
    if (date) dates.push(date);

    const bucket = resolveUnifiedSentiment(row);
    sentiment[bucket] += 1;

    const itemLikes = parseEngagementNumber(row.likes);
    const itemComments = parseEngagementNumber(row.comments);
    const itemShares = twitterShareCount(row);
    const engagement = unifiedEngagement(row);
    likes += itemLikes;
    comments += itemComments;
    shares += itemShares;
    totalEngagement += engagement;

    const handle =
      (row.author_display_name ?? "").trim() ||
      (row.author ?? "").trim() ||
      "Unknown";
    const handleKey = handle.toLowerCase();
    const postUrl = sanitizeHttpUrl(row.url);
    const followers =
      parseEngagementNumber(row.author_followers) ||
      lookupFollowers(FACEBOOK_FOLLOWERS, handle);

    trackEntity(handles, handleKey, handle, handle, engagement, bucket, {
      link: postUrl,
      likes: itemLikes,
      followers,
    });

    posts.push({
      name: handle,
      handle,
      timestamp: formatPostTimestamp(date),
      text: trimSnippet(row.text || row.title, 170),
      language: (row.language || "en").trim() || "en",
      sentiment: bucket,
      likes: itemLikes,
      shares: itemShares,
      comments: itemComments,
      views: unifiedRowViews(row),
      url: postUrl,
      image: mediaPostImage(row),
      engagement,
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
      totalReach: sumEntityFollowers(handles),
      socialMentions: filtered.length,
      socialUsers: handles.size,
      webMentions: 0,
      webSites: 0,
    },
    dailyTimeline: buildDailyTimeline(dates, start, end),
    sentiment: sentimentSeries(sentiment),
    engagementBreakdown: buildEngagementBreakdown(likes, shares, comments),
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

  const pushUnifiedDocs = (
    filePath: string,
    engagementFn: (row: Record<string, string>) => number
  ) => {
    for (const row of readCsv(filePath)) {
      const date = parseUnifiedCsvDate(row);
      if (!inDateRange(date, start, end)) continue;
      if (!matchesUnifiedMediaSearch(filters, row)) continue;
      const text = (row.text ?? row.title ?? row.summary ?? "").trim();
      const url = sanitizeHttpUrl(row.url) || parseFirstUrl(row.url);
      if (!text) continue;
      docs.push({
        text,
        url,
        engagement: engagementFn(row),
        views: unifiedRowViews(row),
        sentiment: resolveUnifiedSentiment(row),
      });
    }
  };

  try {
    pushUnifiedDocs(DATA_FILES.twitter, twitterEngagement);
  } catch {
    /* skip twitter */
  }
  try {
    pushUnifiedDocs(DATA_FILES.online, unifiedEngagement);
  } catch {
    /* skip online */
  }
  try {
    pushUnifiedDocs(DATA_FILES.youtube, unifiedEngagement);
  } catch {
    /* skip youtube */
  }
  try {
    pushUnifiedDocs(DATA_FILES.facebook, unifiedEngagement);
  } catch {
    /* skip facebook */
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



