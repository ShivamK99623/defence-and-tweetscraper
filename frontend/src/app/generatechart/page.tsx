"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { EChartsOption } from "echarts";
import { FaYoutube } from "react-icons/fa";
import {
  FaXTwitter,
  FaShareNodes,
  FaRegEye,
  FaUsers,
  FaPlay,
  FaRegThumbsUp,
  FaRegComment,
  FaRegFaceSmile,
  FaRegFaceFrown,
  FaRegFaceMeh,
  FaArrowUpRightFromSquare,
  FaInstagram,
  FaFacebook,
} from "react-icons/fa6";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineMegaphone,
  HiOutlineShare,
  HiOutlineDocumentText,
} from "react-icons/hi2";
import { MdVerified } from "react-icons/md";
import { IoRefresh } from "react-icons/io5";
import { Download, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReactToPrint } from "react-to-print";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-[#8E949B]">
      Loading chart…
    </div>
  ),
});

/* ------------------------------------------------------------------ */
/* Types (mirror backend/src/chartdata.ts)                             */
/* ------------------------------------------------------------------ */

type PlatformKey = "twitter" | "online" | "youtube" | "instagram" | "facebook";
type SentimentBucket = "positive" | "negative" | "neutral";

interface SentimentMix {
  positive: number;
  negative: number;
  neutral: number;
}

interface TopEntityRow {
  name: string;
  handle: string;
  link?: string;
  mentions: number;
  engagement: number;
  followers: number | null;
  views?: number | null;
  likes?: number | null;
  sentiment: SentimentBucket;
  sentimentMix: SentimentMix;
  subLabel?: string;
}

interface PostItem {
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

interface ActorGroupPosts {
  id: string;
  title: string;
  posts: PostItem[];
}

interface ExecutiveSummaryPayload {
  paragraph: string;
  bullets: { lead: string; body: string }[];
}

interface ArticleItem {
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

interface VideoItem {
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

interface PlatformChartPayload {
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
  actorGroups?: ActorGroupPosts[];
  accentColor: string;
}

/* ------------------------------------------------------------------ */
/* Palette — sampled directly from the source PDF                      */
/* ------------------------------------------------------------------ */

const C = {
  ink: "#111111",
  muted: "#8E949B",
  gold: "#C6A670",
  crimson: "#BD1D51",
  cyan: "#00C0EF",
  webOrange: "#F39C12",
  ytRed: "#F50332",
  donutLikes: "#0A4CF3",
  donutShares: "#ED8A10",
  donutComments: "#7F3FBE",
  sentPositive: "#58BE56",
  sentNegative: "#C82333",
  sentNeutral: "#A3A3A3",
  kpiChat: "#D3004D",
  kpiMega: "#4FB8F4",
  kpiShare: "#F14F02",
  faceSad: "#FF5252",
  faceHappy: "#58BE56",
  linkBlue: "#2563EB",
  handleBlue: "#60A5FA",
  samvad: "#1A4D8C",
  grid: "#D1D5DB",
  axis: "#E5E7EB",
  rowBorder: "#F1F2F4",
  twitter: "#1DA1F2",
  youtube: "#FF0000",
  instagram: "#C13584",
  facebook: "#1877F2",
  doc: "#1A4D8C",
};

const DEFAULT_START_DATE = "2026-06-25";
const DEFAULT_END_DATE = "2026-07-12";
const DEFAULT_REPORT_TITLE = "Analytical Report on Operation Sindoor Controversy";
const SLIDE_W = 1152;
const SLIDE_H = 648;

type KeywordMode = "and" | "or";
type SearchFieldKey = "content" | "title" | "author" | "summary" | "url" | "tags";

const ALL_SEARCH_FIELDS: SearchFieldKey[] = [
  "content",
  "title",
  "author",
  "summary",
  "url",
  "tags",
];

const SEARCH_FIELD_LABELS: Record<SearchFieldKey, string> = {
  content: "Content",
  title: "Title / Headline",
  author: "Author / Handle",
  summary: "Summary",
  url: "URL / Link",
  tags: "Tags",
};

interface ChartFilters {
  keyword: string;
  keywordMode: KeywordMode;
  searchFields: SearchFieldKey[];
  startDate: string;
  endDate: string;
  reportTitle: string;
}

interface ChartMeta {
  reportTitle: string;
  keyword: string;
  keywordMode?: KeywordMode;
  searchFields?: SearchFieldKey[];
  dateRange: { start: string; end: string };
  queryType?: "none" | "boolean" | "keyword_and" | "keyword_or";
  queryTypeLabel?: string;
  generatedQuery?: string;
}

const ReportMetaContext = createContext<{
  reportTitle: string;
  dateRangeLabel: string;
}>({
  reportTitle: DEFAULT_REPORT_TITLE,
  dateRangeLabel: "Jun 25, 2026 - Jul 12, 2026",
});

function formatDateRangeLabel(start: string, end: string): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

function describeQueryLocal(filters: ChartFilters): Pick<
  ChartMeta,
  "queryType" | "queryTypeLabel" | "generatedQuery"
> {
  const raw = filters.keyword.trim();
  if (!raw) {
    return {
      queryType: "none",
      queryTypeLabel: "No keyword filter",
      generatedQuery: "(all mentions in date range)",
    };
  }
  if (/[()]|\b(and|or)\b|&&|\|\|/i.test(raw)) {
    return {
      queryType: "boolean",
      queryTypeLabel: "Boolean expression (AND / OR / groups)",
      generatedQuery: raw,
    };
  }
  const terms = raw
    .split(/[,;]/)
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  const joiner = filters.keywordMode === "or" ? " OR " : " AND ";
  return {
    queryType: filters.keywordMode === "or" ? "keyword_or" : "keyword_and",
    queryTypeLabel:
      filters.keywordMode === "or"
        ? "Keyword list (OR — any term matches)"
        : "Keyword list (AND — all terms must match)",
    generatedQuery: terms.map((t) => (t.includes(" ") ? `"${t}"` : t)).join(joiner) || raw,
  };
}

function buildAllUrl(base: string, filters: ChartFilters): string {
  const params = new URLSearchParams();
  if (filters.keyword.trim()) params.set("keyword", filters.keyword.trim());
  if (filters.keywordMode) params.set("keywordMode", filters.keywordMode);
  if (filters.searchFields.length && filters.searchFields.length < ALL_SEARCH_FIELDS.length) {
    params.set("searchFields", filters.searchFields.join(","));
  } else if (filters.searchFields.length === ALL_SEARCH_FIELDS.length) {
    params.set("searchFields", filters.searchFields.join(","));
  }
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.reportTitle.trim()) params.set("reportTitle", filters.reportTitle.trim());
  const qs = params.toString();
  return qs ? `${base}/api/mentionreport/all?${qs}` : `${base}/api/mentionreport/all`;
}

type HeaderVariant = "gold" | "crimson" | "cyan" | "red";
const HEADER_FILL: Record<HeaderVariant, string> = {
  gold: C.gold,
  crimson: C.crimson,
  cyan: C.cyan,
  red: C.ytRed,
};

const SENTIMENT_COLOR: Record<SentimentBucket, string> = {
  positive: C.sentPositive,
  negative: C.sentNegative,
  neutral: C.sentNeutral,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function overviewAxisDate(iso: string, i: number, total: number): string {
  if (i === total - 1) return "Yesterday";
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`;
}

function lineAxisDate(iso: string, i: number, total: number): string {
  if (i === total - 1) return "Yesterday";
  const d = new Date(`${iso}T00:00:00`);
  return `${d.toLocaleDateString("en-US", { month: "short" })}, ${d.getDate()}`;
}

function sentimentPercents(sentiment: PlatformChartPayload["sentiment"]) {
  const total = sentiment.reduce((s, i) => s + i.value, 0) || 1;
  return sentiment.map((i) => ({
    ...i,
    percent: ((i.value / total) * 100).toFixed(1),
  }));
}

/* ------------------------------------------------------------------ */
/* Slide frame (fixed 1152x648 canvas scaled to container width)       */
/* ------------------------------------------------------------------ */

function Slide({
  page,
  title,
  children,
  center = false,
}: {
  page: number;
  title: string;
  children: ReactNode;
  center?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / SLIDE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id={`page-${page}`}
      data-page={page}
      data-title={title}
      className="relative mx-auto w-full bg-white shadow-sm ring-1 ring-black/5"
      style={{ maxWidth: SLIDE_W, aspectRatio: `${SLIDE_W} / ${SLIDE_H}` }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}
        data-slide-surface
      >
        <div
          className={`flex h-full w-full flex-col px-10 pb-14 pt-5 ${
            center ? "items-center justify-center" : ""
          }`}
        >
          {children}
        </div>
        <SlideFooter />
      </div>
    </section>
  );
}

function SamvadWordmark({ size = 13 }: { size?: number }) {
  return (
    <span
      className="font-bold tracking-wide"
      style={{ color: C.samvad, fontSize: size }}
    >
      SAMVAD <span className="font-normal">2.0</span>
    </span>
  );
}

function SlideFooter() {
  const { dateRangeLabel } = useContext(ReportMetaContext);
  return (
    <div
      className="absolute inset-x-10 bottom-0 flex items-center justify-between border-t pt-2"
      style={{ borderColor: C.axis, height: 34 }}
    >
      {/* <span className="flex items-center gap-2 text-[13px]" style={{ color: C.muted }}>
        <FaRegCalendarAlt className="h-3.5 w-3.5" />
        {dateRangeLabel}
      </span>
      <SamvadWordmark /> */}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header band                                                         */
/* ------------------------------------------------------------------ */

function PlatformGlyph({ platform, className }: { platform: PlatformKey | "doc"; className?: string }) {
  switch (platform) {
    case "twitter":
      return <FaXTwitter className={className} style={{ color: C.twitter }} />;
    case "youtube":
      return <FaYoutube className={className} style={{ color: C.youtube }} />;
    case "instagram":
      return <FaInstagram className={className} style={{ color: C.instagram }} />;
    case "facebook":
      return <FaFacebook className={className} style={{ color: C.facebook }} />;
    case "online":
    case "doc":
      return <Globe className={className} style={{ color: C.doc }} size={15} />;
    default:
      return null;
  }
}

function HeaderBand({
  variant,
  title,
  subtitle,
  description,
  icon,
}: {
  variant: HeaderVariant;
  title: string;
  subtitle: string;
  description?: string;
  icon?: PlatformKey | "doc";
}) {
  return (
    <div className="mb-5 flex items-start gap-6">
      <div
        className="-ml-10 flex min-h-[60px] items-center text-white"
        style={{ backgroundColor: HEADER_FILL[variant] }}
      >
        {icon ? (
          <div
            className="flex h-[60px] w-[64px] items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.16)" }}
          >
            <PlatformGlyph platform={icon} className="h-7 w-7 text-white!" />
          </div>
        ) : (
          <span className="w-4" />
        )}
        <div className="px-5 py-2 pr-8">
          <h2 className="text-[22px] font-semibold leading-tight">{title}</h2>
          <p className="text-[14px] leading-tight text-white/90">{subtitle}</p>
        </div>
      </div>
      {description ? (
        <p
          className="max-w-[620px] pt-2 text-[15px] leading-snug"
          style={{ color: C.muted }}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sentiment mix bar                                                   */
/* ------------------------------------------------------------------ */

function SentimentMixBar({
  mix,
  width,
  height = 9,
  radius = 2,
}: {
  mix: SentimentMix;
  width?: number;
  height?: number;
  radius?: number;
}) {
  const total = mix.positive + mix.negative + mix.neutral;
  const seg = (v: number, color: string) =>
    v > 0 ? (
      <div style={{ width: `${(v / total) * 100}%`, backgroundColor: color }} />
    ) : null;
  return (
    <div
      className="flex overflow-hidden"
      style={{
        width: width ?? "100%",
        height,
        borderRadius: radius,
        backgroundColor: total === 0 ? C.sentNeutral : "#E5E7EB",
      }}
    >
      {seg(mix.positive, C.sentPositive)}
      {seg(mix.negative, C.sentNegative)}
      {seg(mix.neutral, C.sentNeutral)}
    </div>
  );
}

function SentimentFace({ mix, size = 30 }: { mix: SentimentMix; size?: number }) {
  const happy = mix.positive >= mix.negative && mix.positive >= mix.neutral;
  const sad = mix.negative > mix.positive && mix.negative >= mix.neutral;
  if (happy && mix.positive > 0)
    return <FaRegFaceSmile style={{ color: C.faceHappy, fontSize: size }} />;
  if (sad) return <FaRegFaceFrown style={{ color: C.faceSad, fontSize: size }} />;
  return <FaRegFaceMeh style={{ color: C.sentNeutral, fontSize: size }} />;
}

function MiniFace({ sentiment, size = 15 }: { sentiment: SentimentBucket; size?: number }) {
  if (sentiment === "positive")
    return <FaRegFaceSmile style={{ color: C.sentPositive, fontSize: size }} />;
  if (sentiment === "negative")
    return <FaRegFaceFrown style={{ color: C.sentNegative, fontSize: size }} />;
  return <FaRegFaceMeh style={{ color: C.sentNeutral, fontSize: size }} />;
}

/* ------------------------------------------------------------------ */
/* KPI row                                                             */
/* ------------------------------------------------------------------ */

function KpiRow({
  data,
  platform,
}: {
  data: PlatformChartPayload;
  platform: PlatformKey | "overview";
}) {
  const percents = sentimentPercents(data.sentiment);
  const breakdown = data.engagementBreakdown ?? [];
  const likes = breakdown.find((b) => b.name === "Likes")?.value ?? 0;
  const shares = breakdown.find((b) => b.name === "Shares")?.value ?? 0;
  const comments = breakdown.find((b) => b.name === "Comments")?.value ?? 0;
  const reach = data.kpis.totalReach;
  const mix: SentimentMix = {
    positive: data.sentiment.find((s) => s.name.toLowerCase() === "positive")?.value ?? 0,
    negative: data.sentiment.find((s) => s.name.toLowerCase() === "negative")?.value ?? 0,
    neutral: data.sentiment.find((s) => s.name.toLowerCase() === "neutral")?.value ?? 0,
  };

  const hideSocialReach = platform === "online";
  const showFollowerReach =
    platform === "youtube" ||
    platform === "instagram" ||
    platform === "facebook" ||
    platform === "overview";

  return (
    <div
      className={`mb-3 grid gap-4 border-b pb-4 ${hideSocialReach ? "grid-cols-3" : "grid-cols-4"}`}
      style={{ borderColor: C.axis }}
    >
      {/* Total Mentions */}
      <div className="flex gap-3">
        <HiOutlineChatBubbleLeftRight
          className="mt-1 h-8 w-8 shrink-0"
          style={{ color: C.kpiChat }}
        />
        <div>
          <p className="text-[13px]" style={{ color: C.muted }}>Total Mentions</p>
          <p className="text-[34px] font-semibold leading-none" style={{ color: C.ink }}>
            {data.kpis.totalMentions}
          </p>
          <p className="text-[11px]" style={{ color: C.muted }}>total</p>
          <p className="mt-1 text-[11px] leading-snug" style={{ color: C.muted }}>
            {data.kpis.socialMentions} Social from {data.kpis.socialUsers} users
            <br />
            {data.kpis.webMentions} Web on {data.kpis.webSites} sites
          </p>
        </div>
      </div>

      {/* Social Reach — hidden for web */}
      {!hideSocialReach ? (
        <div className="flex gap-3">
          <HiOutlineMegaphone className="mt-1 h-8 w-8 shrink-0" style={{ color: C.kpiMega }} />
          <div>
            <p className="text-[13px]" style={{ color: C.muted }}>Social Reach</p>
            <p className="text-[34px] font-semibold leading-none" style={{ color: C.ink }}>
              {reach > 0 ? formatNumber(reach) : "–"}
            </p>
            <p className="text-[11px]" style={{ color: C.muted }}>
              {showFollowerReach ? "followers" : "unique"}
            </p>
            {reach > 0 && platform === "twitter" ? (
              <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: C.muted }}>
                <FaXTwitter style={{ color: C.cyan }} /> {formatNumber(reach)}
              </p>
            ) : null}
            {reach > 0 && platform === "youtube" ? (
              <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: C.muted }}>
                <FaYoutube style={{ color: C.ytRed }} /> {formatNumber(reach)}
              </p>
            ) : null}
            {reach > 0 && platform === "instagram" ? (
              <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: C.muted }}>
                <FaInstagram style={{ color: "#E1306C" }} /> {formatNumber(reach)}
              </p>
            ) : null}
            {reach > 0 && platform === "facebook" ? (
              <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: C.muted }}>
                <FaFacebook style={{ color: "#1877F2" }} /> {formatNumber(reach)}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Social Engagement */}
      <div className="flex gap-3">
        <HiOutlineShare className="mt-1 h-8 w-8 shrink-0" style={{ color: C.kpiShare }} />
        <div>
          <p className="text-[13px]" style={{ color: C.muted }}>Social Engagement</p>
          <p className="text-[34px] font-semibold leading-none" style={{ color: C.ink }}>
            {formatNumber(data.kpis.totalEngagement)}
          </p>
          <p className="text-[11px]" style={{ color: C.muted }}>total</p>
          {breakdown.length > 0 ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: C.muted }}>
              <span className="inline-flex items-center gap-1"><FaRegThumbsUp /> {formatNumber(likes)}</span>
              {shares > 0 ? (
                <span className="inline-flex items-center gap-1"><FaShareNodes /> {formatNumber(shares)}</span>
              ) : null}
              <span className="inline-flex items-center gap-1"><FaRegComment /> {formatNumber(comments)}</span>
              {reach > 0 && platform === "twitter" ? (
                <span className="inline-flex items-center gap-1"><FaRegEye /> {formatNumber(reach)}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Sentiment Analysis */}
      <div className="flex gap-3">
        <span className="mt-1 shrink-0"><SentimentFace mix={mix} size={30} /></span>
        <div className="w-full">
          <p className="mb-1 text-[13px]" style={{ color: C.muted }}>Sentiment Analysis</p>
          <div className="grid grid-cols-3 gap-2">
            {percents.map((item) => (
              <div key={item.name} className="text-center">
                <p className="text-[17px] font-bold leading-none" style={{ color: C.ink }}>
                  {item.percent}%
                </p>
                <p className="text-[11px]" style={{ color: C.muted }}>({item.value})</p>
                <p className="text-[12px] lowercase" style={{ color: item.color }}>
                  {item.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

const chartGrid = { left: 46, right: 24, top: 22, bottom: 70, containLabel: false };
const chartAxis = {
  splitLine: { lineStyle: { color: C.grid, type: "dashed" as const } },
  axisLabel: { color: C.muted, fontSize: 11 },
  axisLine: { lineStyle: { color: C.axis } },
};

type OverviewLegend = { label: string; count: number; color: string; pctLabel: string };

function groupedOverviewOption(
  platforms: PlatformChartPayload[],
  legend: OverviewLegend[]
): EChartsOption {
  const base = platforms[0]?.dailyTimeline ?? [];
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: chartGrid,
    xAxis: {
      type: "category",
      data: base.map((d, i) => overviewAxisDate(d.date, i, base.length)),
      axisLabel: { ...chartAxis.axisLabel, rotate: 35 },
      axisLine: chartAxis.axisLine,
      axisTick: { show: false },
    },
    yAxis: { type: "value", ...chartAxis },
    legend: {
      bottom: 4,
      left: "center",
      icon: "rect",
      itemWidth: 22,
      itemHeight: 12,
      itemGap: 26,
      textStyle: { color: "#555", fontSize: 12 },
      data: legend.map((l) => `${l.label} ${l.count} (${l.pctLabel})`),
    } as EChartsOption["legend"],
    series: legend.map((l, idx) => ({
      name: `${l.label} ${l.count} (${l.pctLabel})`,
      type: "bar" as const,
      barGap: "20%",
      itemStyle: { color: l.color },
      data: platforms[idx]?.dailyTimeline.map((d) => d.count) ?? [],
    })),
  };
}

function lineOption(data: PlatformChartPayload, color: string, label: string): EChartsOption {
  const t = data.dailyTimeline;
  const total = t.reduce((s, d) => s + d.count, 0);
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    grid: chartGrid,
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: t.map((d, i) => lineAxisDate(d.date, i, t.length)),
      axisLabel: { ...chartAxis.axisLabel, rotate: 35 },
      axisLine: chartAxis.axisLine,
      axisTick: { show: false },
    },
    yAxis: { type: "value", ...chartAxis },
    legend: {
      bottom: 4,
      left: "center",
      icon: "roundRect",
      itemWidth: 22,
      itemHeight: 12,
      textStyle: { color: "#555", fontSize: 12 },
      data: [`${label} ${total} (100.0%)`],
    },
    series: [
      {
        name: `${label} ${total} (100.0%)`,
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 2.5, color },
        itemStyle: { color, borderColor: "#fff", borderWidth: 1 },
        data: t.map((d) => d.count),
      },
    ],
  };
}

const DONUT_COLORS: Record<string, string> = {
  Likes: C.donutLikes,
  Shares: C.donutShares,
  Comments: C.donutComments,
};

function donutOption(items: { name: string; value: number }[]): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: {
      orient: "vertical",
      right: "16%",
      top: "center",
      icon: "rect",
      itemWidth: 15,
      itemHeight: 15,
      itemGap: 14,
      textStyle: { color: "#555", fontSize: 13 },
      formatter: (name: string) => {
        const it = items.find((i) => i.name === name);
        return `${name} ${it ? formatNumber(it.value) : ""}`;
      },
    },
    series: [
      {
        type: "pie",
        radius: ["42%", "70%"],
        center: ["30%", "50%"],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        data: items.map((i) => ({
          name: i.name,
          value: i.value,
          itemStyle: { color: DONUT_COLORS[i.name] ?? "#64748B" },
        })),
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Ranking table                                                       */
/* ------------------------------------------------------------------ */

const COL_TEMPLATE = "44px 52px 1fr 110px 96px 118px 96px";
const COL_TEMPLATE_NO_METRIC = "44px 52px 1fr 96px 118px 96px";

function rankingMetricLabel(platform: PlatformKey): string | null {
  if (platform === "online") return null;
  if (platform === "twitter") return "Views";
  if (platform === "youtube" || platform === "instagram" || platform === "facebook") {
    return "Followers";
  }
  return null;
}

function rankingMetricValue(row: TopEntityRow, platform: PlatformKey): string {
  if (platform === "twitter") {
    return row.views != null ? formatNumber(row.views) : "–";
  }
  if (platform === "youtube" || platform === "instagram" || platform === "facebook") {
    return row.followers != null ? formatNumber(row.followers) : "–";
  }
  return "–";
}

function RankingHeaderRow({ platform }: { platform: PlatformKey }) {
  const metric = rankingMetricLabel(platform);
  const cols = metric ? COL_TEMPLATE : COL_TEMPLATE_NO_METRIC;
  return (
    <div
      className="grid items-end pb-2 text-[15px]"
      style={{ gridTemplateColumns: cols, color: C.muted }}
    >
      <span />
      <span />
      <span />
      {metric ? <span className="text-right">{metric}</span> : null}
      <span className="border-l text-right" style={{ borderColor: C.axis }}>Mentions</span>
      <span className="border-l text-right" style={{ borderColor: C.axis }}>Engagement</span>
      <span className="border-l text-right" style={{ borderColor: C.axis }}>Sentiment</span>
    </div>
  );
}

function avatarColor(platform: PlatformKey): string {
  if (platform === "online") return "#D4A574";
  if (platform === "youtube") return "#FCA5A5";
  if (platform === "instagram") return "#F9A8D4";
  if (platform === "facebook") return "#93C5FD";
  return "#CBD5E1";
}

function RankingRow({
  rank,
  row,
  platform,
}: {
  rank: number;
  row: TopEntityRow;
  platform: PlatformKey;
}) {
  const metric = rankingMetricLabel(platform);
  const cols = metric ? COL_TEMPLATE : COL_TEMPLATE_NO_METRIC;
  const nameNode = row.link ? (
    <a
      href={row.link}
      target="_blank"
      rel="noopener noreferrer"
      className="truncate text-[16px] font-medium hover:underline"
      style={{ color: C.linkBlue }}
    >
      {row.name}
    </a>
  ) : (
    <span className="truncate text-[16px] font-medium" style={{ color: C.linkBlue }}>
      {row.name}
    </span>
  );

  return (
    <div
      className="grid items-center border-b py-2"
      style={{ gridTemplateColumns: cols, borderColor: C.rowBorder }}
    >
      <span className="text-[26px] font-light" style={{ color: "#C7CBD1" }}>{rank}</span>
      <div
        className="flex h-11 w-11 items-center justify-center rounded-md text-[15px] font-bold text-white"
        style={{ backgroundColor: avatarColor(platform) }}
      >
        {row.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 pr-4">
        <div className="flex items-center gap-1.5">
          <PlatformGlyph
            platform={platform === "online" ? "doc" : platform}
            className='shrink-0'
          />
          {nameNode}
          {platform === "twitter" ? (
            <MdVerified className="shrink-0" style={{ color: C.linkBlue }} />
          ) : null}
        </div>
        {platform === "online" ? (
          <p className="truncate text-[12px]" style={{ color: C.muted }}>
            {row.subLabel ?? "Rank # - | Global # -"}
          </p>
        ) : platform === "twitter" ||
          platform === "instagram" ||
          platform === "facebook" ? (
          row.link ? (
            <a
              href={row.link.replace(/\s+/g, "")}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[13px] hover:underline"
              style={{ color: C.handleBlue }}
            >
              {row.handle}
            </a>
          ) : (
            <p className="truncate text-[13px]" style={{ color: C.handleBlue }}>{row.handle}</p>
          )
        ) : platform === "youtube" && row.link ? (
          <a
            href={row.link.replace(/\s+/g, "")}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-[12px] hover:underline"
            style={{ color: C.muted }}
          >
            Open video
          </a>
        ) : (
          <span className="block h-[6px]" />
        )}
        <div className="mt-1">
          <SentimentMixBar mix={row.sentimentMix} height={4} />
        </div>
      </div>
      {metric ? (
        <p className="text-right text-[16px]" style={{ color: "#444" }}>
          {rankingMetricValue(row, platform)}
        </p>
      ) : null}
      <p className="text-right text-[24px] font-light" style={{ color: "#444" }}>{row.mentions}</p>
      <p className="text-right text-[24px] font-light" style={{ color: "#444" }}>
        {platform === "online" ? "-" : row.engagement > 0 ? formatNumber(row.engagement) : "–"}
      </p>
      <div className="flex justify-end">
        <SentimentMixBar mix={row.sentimentMix} width={84} height={9} />
      </div>
    </div>
  );
}

function RankingPage({
  data,
  platform,
  chunkRows,
  startRank,
  showHeaderBand,
  bandTitle,
}: {
  data: PlatformChartPayload;
  platform: PlatformKey;
  chunkRows: TopEntityRow[];
  startRank: number;
  showHeaderBand: boolean;
  bandTitle: string;
}) {
  return (
    <>
      {showHeaderBand ? (
        <div className="flex items-start justify-between">
          <HeaderBand
            variant="gold"
            icon={platform === "online" ? "doc" : platform}
            title={bandTitle}
            subtitle={platform === "online" ? "Ordered by Mentions" : "Ordered by Engagement"}
            description="This is a list of the most important websites, based on their Alexa Rank, which mentioned your keywords."
          />
          <IoRefresh className="mt-1 h-5 w-5" style={{ color: "#B8BEC6" }} />
        </div>
      ) : (
        <div className="mb-2 flex justify-end">
          <IoRefresh className="h-5 w-5" style={{ color: "#B8BEC6" }} />
        </div>
      )}
      <RankingHeaderRow platform={platform} />
      <div className="flex-1">
        {chunkRows.map((row, i) => (
          <RankingRow key={`${row.handle}-${i}`} rank={startRank + i} row={row} platform={platform} />
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Cards (posts / articles / videos)                                   */
/* ------------------------------------------------------------------ */

function CardIconRow({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 flex items-center gap-2 text-[12px]" style={{ color: C.muted }}>
      {children}
    </div>
  );
}

function LangTag({ lang }: { lang: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="rounded-sm px-1 text-[9px] font-bold text-white"
        style={{ backgroundColor: "#9AA3AC" }}
      >
        A文
      </span>
      {lang}
    </span>
  );
}

function Thumb({ letter, tint, image }: { letter: string; tint: string; image?: string }) {
  if (image) {
    return (
      <div
        className="h-[74px] w-[104px] shrink-0 overflow-hidden rounded-md"
        style={{ backgroundColor: tint }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className="flex h-[74px] w-[104px] shrink-0 items-center justify-center rounded-md text-[22px] font-bold text-white"
      style={{ backgroundColor: tint }}
    >
      {letter}
    </div>
  );
}

function SoftLink({
  href,
  className,
  style,
  children,
}: {
  href?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const clean = (href ?? "").replace(/\s+/g, "").trim();
  if (clean && /^https?:\/\//i.test(clean)) {
    return (
      <a
        href={clean}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className ?? ""} hover:underline`}
        style={style}
      >
        {children}
      </a>
    );
  }
  return (
    <span className={className} style={style}>
      {children}
    </span>
  );
}

function PostCard({ post }: { post: PostItem }) {
  return (
    <div className="flex gap-3">
      <Thumb letter={post.name.charAt(0).toUpperCase()} tint="#CBD5E1" image={post.image} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <SoftLink
            href={post.url}
            className="truncate text-[15px] font-semibold"
            style={{ color: C.linkBlue }}
          >
            {post.name} ({post.handle})
          </SoftLink>
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
            style={{ backgroundColor: "#F1F2F4", color: C.muted }}
          >
            {post.timestamp}
          </span>
        </div>
        <SoftLink
          href={post.url}
          className="mt-0.5 line-clamp-3 block text-[13px] leading-snug"
          style={{ color: C.ink }}
        >
          {post.text}
        </SoftLink>
        <CardIconRow>
          <MiniFace sentiment={post.sentiment} />
          <LangTag lang={post.language} />
          <span className="inline-flex items-center gap-1"><FaShareNodes /> {formatNumber(post.shares)}</span>
          <span className="inline-flex items-center gap-1"><FaRegEye /> {formatNumber(post.views)}</span>
          <span className="inline-flex items-center gap-1"><FaUsers /> {formatNumber(post.likes)}</span>
        </CardIconRow>
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: ArticleItem }) {
  return (
    <div className="flex gap-3">
      <Thumb letter={article.domain.charAt(0).toUpperCase()} tint="#E2C79B" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <SoftLink
            href={article.url}
            className="truncate text-[15px] font-semibold"
            style={{ color: C.linkBlue }}
          >
            {article.domain}
          </SoftLink>
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
            style={{ backgroundColor: "#F1F2F4", color: C.muted }}
          >
            {article.timestamp}
          </span>
        </div>
        <SoftLink
          href={article.url}
          className="mt-0.5 line-clamp-2 block text-[13px] font-semibold leading-snug"
          style={{ color: C.ink }}
        >
          {article.title}
        </SoftLink>
        <p className="line-clamp-1 text-[12px]" style={{ color: C.muted }}>{article.snippet}</p>
        <CardIconRow>
          <MiniFace sentiment={article.sentiment} />
          <span
            className="rounded-sm px-1.5 py-0.5 text-[10px]"
            style={{ backgroundColor: "#F1F2F4", color: C.muted }}
          >
            {article.tag}
          </span>
          <LangTag lang={article.language} />
          <span className="inline-flex items-center gap-1"><FaShareNodes /> 0</span>
          <span>N/A</span>
          <span className="inline-flex items-center gap-1"><FaArrowUpRightFromSquare /> {article.rankLabel}</span>
        </CardIconRow>
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: VideoItem }) {
  return (
    <div className="flex gap-3">
      <Thumb letter={video.channel.charAt(0).toUpperCase()} tint="#F0A0A0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <SoftLink
            href={video.url}
            className="truncate text-[15px] font-semibold"
            style={{ color: C.linkBlue }}
          >
            {video.channel}
          </SoftLink>
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
            style={{ backgroundColor: "#F1F2F4", color: C.muted }}
          >
            {video.timestamp}
          </span>
        </div>
        <SoftLink
          href={video.url}
          className="mt-0.5 line-clamp-2 block text-[13px] font-semibold leading-snug"
          style={{ color: C.ink }}
        >
          {video.title}
        </SoftLink>
        <p className="line-clamp-1 text-[12px]" style={{ color: C.muted }}>{video.snippet}</p>
        <CardIconRow>
          <MiniFace sentiment={video.sentiment} />
          <LangTag lang={video.language} />
          <span className="inline-flex items-center gap-1"><FaRegThumbsUp /> {formatNumber(video.likes)}</span>
          <span className="inline-flex items-center gap-1"><FaRegComment /> {formatNumber(video.comments)}</span>
          {video.url ? (
            <a href={video.url} target="_blank" rel="noopener noreferrer" aria-label="Open video">
              <FaPlay style={{ color: C.ytRed }} />
            </a>
          ) : (
            <FaPlay style={{ color: C.ytRed }} />
          )}
        </CardIconRow>
      </div>
    </div>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid flex-1 grid-cols-2 gap-x-10 gap-y-4 pt-1">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Narrative pages (Executive Summary + Trending Topics)               */
/* ------------------------------------------------------------------ */

function ExecutiveSummary({ summary }: { summary: ExecutiveSummaryPayload | null }) {
  if (!summary) return null;
  return (
    <Slide page={3} title="Executive Summary">
      <HeaderBand variant="crimson" title="Executive Summary" subtitle="Summary of the clustered topics" />
      <p className="max-w-[1030px] text-[16px] leading-relaxed" style={{ color: C.ink }}>
        {summary.paragraph}
      </p>
      <ul className="mt-5 space-y-2.5 pl-6">
        {summary.bullets.map((b) => (
          <li key={b.lead} className="list-disc text-[15px] leading-snug" style={{ color: C.ink }}>
            <span className="font-bold">{b.lead} :-</span>
            {b.body}
          </li>
        ))}
      </ul>
    </Slide>
  );
}

interface TrendingTopicItem {
  cluster: string;
  url: string;
  mentions: string;
  reach: string;
  engagement: string;
  mix: SentimentMix;
}

function TrendingTopics({ topics, startRank = 0 }: { topics: TrendingTopicItem[] , startRank?: number}) {
  const cols = "40px 1fr 96px 96px 118px 104px";
  if (!topics.length) return null;
  return (
    <Slide page={4} title="Top Trending Topics">
      <HeaderBand variant="crimson" title="Top Trending Topics" subtitle="Top Clusters, Ordered by total mentions" />
      <div
        className="grid items-end pb-2 text-[15px]"
        style={{ gridTemplateColumns: cols, color: C.muted }}
      >
        <span />
        <span className="pl-2">Mention Cluster</span>
        <span className="text-right">Mentions</span>
        <span className="border-l text-right" style={{ borderColor: C.axis }}>Reach</span>
        <span className="border-l text-right" style={{ borderColor: C.axis }}>Engagement</span>
        <span className="border-l text-center" style={{ borderColor: C.axis }}>Sentiment</span>
      </div>
      <div className="flex-1">
        {topics.map((t, i) => (
          <div
            key={`${t.url}-${i}`}
            className="grid items-center border-b py-3"
            style={{ gridTemplateColumns: cols, borderColor: C.rowBorder }}
          >
            <span className="self-start text-[16px]" style={{ color: C.muted }}>{startRank + i + 1}</span>
            <div className="min-w-0 pl-2 pr-4">
              <SoftLink
                href={t.url}
                className="line-clamp-3 block text-[13px] leading-snug hover:underline"
                style={{ color: t.url ? C.linkBlue : C.muted }}
              >
                {t.cluster}
              </SoftLink>
              {t.url && t.url !== "" ? (
                <a
                  href={t.url.replace(/\s+/g, "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-[11px] hover:underline"
                  style={{ color: C.muted }}
                >
                  <FaArrowUpRightFromSquare className="h-2.5 w-2.5" />
                  Open post
                </a>
              ) : null}
            </div>
            <span className="text-right text-[16px]" style={{ color: C.ink }}>{t.mentions}</span>
            <span className="text-right text-[16px]" style={{ color: C.ink }}>{t.reach}</span>
            <span className="text-right text-[16px]" style={{ color: C.ink }}>{t.engagement}</span>
            <div className="flex justify-center"><SentimentMixBar mix={t.mix} width={92} height={10} /></div>
          </div>
        ))}
      </div>
    </Slide>
  );
}

/* ------------------------------------------------------------------ */
/* Cover + Divider                                                     */
/* ------------------------------------------------------------------ */

function CoverPage() {
  const { reportTitle, dateRangeLabel } = useContext(ReportMetaContext);
  const ref = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / SLIDE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="page-1"
      data-page={1}
      data-title="Cover"
      className="relative mx-auto w-full overflow-hidden bg-white shadow-sm ring-1 ring-black/5"
      style={{ maxWidth: SLIDE_W, aspectRatio: `${SLIDE_W} / ${SLIDE_H}` }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}
        data-slide-surface
      >
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-white">
          <div
            className="pointer-events-none absolute left-0 top-0 h-[70%] w-[36%]"
            style={{ background: "radial-gradient(circle at top left, rgba(255,153,51,0.55), transparent 68%)" }}
          />
          <div
            className="pointer-events-none absolute bottom-0 right-0 h-[70%] w-[36%]"
            style={{ background: "radial-gradient(circle at bottom right, rgba(19,136,8,0.5), transparent 68%)" }}
          />

          <div className="relative z-10 flex flex-col items-center text-center">
            <h1 className="max-w-[820px] text-[34px] font-bold" style={{ color: C.ink }}>
              {reportTitle}
            </h1>
            <p className="mt-3 text-[16px]" style={{ color: "#333" }}>
              Date range: {dateRangeLabel}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function DividerSlide({ page, title }: { page: number; title: string }) {
  return (
    <Slide page={page} title={title} center>
      <h2 className="text-[34px]" style={{ color: C.ink }}>{title}</h2>
    </Slide>
  );
}

/* ------------------------------------------------------------------ */
/* Overview / platform slides                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Chart export registry (high-res ECharts PNG for react-pdf)          */
/* ------------------------------------------------------------------ */

type ChartExportKey =
  | "overview"
  | "twitter-timeline"
  | "twitter-engagement"
  | "online-timeline"
  | "youtube-timeline"
  | "youtube-engagement"
  | "instagram-timeline"
  | "facebook-timeline";

const PLATFORM_ORDER: PlatformKey[] = [
  "twitter",
  "online",
  "youtube",
  "instagram",
  "facebook",
];

const chartExportRegistry = new Map<
  ChartExportKey,
  // ECharts instance — only getDataURL is used for PDF export
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>();

function ChartBox({
  option,
  height = 372,
  exportKey,
}: {
  option: EChartsOption;
  height?: number;
  exportKey?: ChartExportKey;
}) {
  return (
    <div className="flex-1">
      <ReactECharts
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        onChartReady={(chart) => {
          if (exportKey) chartExportRegistry.set(exportKey, chart);
        }}
      />
    </div>
  );
}

function OverviewSlide({ platforms }: { platforms: PlatformChartPayload[] }) {
  const legendMeta: Record<string, { label: string; color: string }> = {
    twitter: { label: "Twitter", color: C.cyan },
    online: { label: "Web", color: C.webOrange },
    youtube: { label: "YouTube", color: C.ytRed },
    instagram: { label: "Instagram", color: "#E1306C" },
    facebook: { label: "Facebook", color: "#1877F2" },
  };
  const selected = PLATFORM_ORDER
    .map((k) => platforms.find((p) => p.platform === k))
    .filter(Boolean) as PlatformChartPayload[];

  const agg = useMemo(() => {
    const sum = (f: (p: PlatformChartPayload) => number) =>
      platforms.reduce((s, p) => s + f(p), 0);
    const sentiment = (["positive", "negative", "neutral"] as SentimentBucket[]).map((key) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: platforms.reduce(
        (s, p) => s + (p.sentiment.find((x) => x.name.toLowerCase() === key)?.value ?? 0),
        0
      ),
      color: SENTIMENT_COLOR[key],
    }));
    return {
      platform: "twitter" as PlatformKey,
      title: "Overview",
      dateRange: { start: "2026-06-25", end: "2026-07-12" },
      kpis: {
        totalMentions: sum((p) => p.kpis.totalMentions),
        uniqueSources: sum((p) => p.kpis.socialUsers + p.kpis.webSites),
        totalEngagement: sum((p) => p.kpis.totalEngagement),
        totalReach: platforms
          .filter((p) => p.platform === "youtube" || p.platform === "instagram" || p.platform === "facebook")
          .reduce((s, p) => s + (p.kpis.totalReach ?? 0), 0),
        socialMentions: sum((p) => p.kpis.socialMentions),
        socialUsers: sum((p) => p.kpis.socialUsers),
        webMentions: sum((p) => p.kpis.webMentions),
        webSites: sum((p) => p.kpis.webSites),
      },
      dailyTimeline: platforms[0]?.dailyTimeline ?? [],
      sentiment,
      engagementBreakdown: [],
      topEntities: [],
      accentColor: "#138808",
    } satisfies PlatformChartPayload;
  }, [platforms]);

  const grandTotal = selected.reduce((s, p) => s + p.kpis.totalMentions, 0) || 1;
  const legend: OverviewLegend[] = selected.map((p) => ({
    label: legendMeta[p.platform].label,
    color: legendMeta[p.platform].color,
    count: p.kpis.totalMentions,
    pctLabel: `${((p.kpis.totalMentions / grandTotal) * 100).toFixed(1)}%`,
  }));

  return (
    <Slide page={2} title="Overview">
      <HeaderBand
        variant="gold"
        title="Overview"
        subtitle="Overall analysis"
        description="The graph shows the posts from each source channel per day."
      />
      <KpiRow data={agg} platform="overview" />
      <ChartBox exportKey="overview" option={groupedOverviewOption(selected, legend)} />
    </Slide>
  );
}

const PLATFORM_LINE: Record<PlatformKey, { color: string; legend: string; band: string }> = {
  twitter: { color: C.cyan, legend: "Twitter", band: "X - Overview" },
  online: { color: C.webOrange, legend: "Web", band: "Web - Overview" },
  youtube: { color: C.ytRed, legend: "YouTube", band: "YT - Overview" },
  instagram: { color: "#E1306C", legend: "Instagram", band: "Instagram - Overview" },
  facebook: { color: "#1877F2", legend: "Facebook", band: "Facebook - Overview" },
};

function PlatformOverviewSlide({ page, data }: { page: number; data: PlatformChartPayload }) {
  const meta = PLATFORM_LINE[data.platform];
  const exportKey = `${data.platform}-timeline` as ChartExportKey;
  return (
    <Slide page={page} title={meta.band}>
      <HeaderBand
        variant="gold"
        icon={data.platform === "online" ? "doc" : data.platform}
        title={meta.band}
        subtitle="Overall analysis"
        description="The graph shows the posts from each source channel per day."
      />
      <KpiRow data={data} platform={data.platform} />
      <ChartBox exportKey={exportKey} option={lineOption(data, meta.color, meta.legend)} />
    </Slide>
  );
}

function EngagementSlide({
  page,
  data,
  variant,
  title,
}: {
  page: number;
  data: PlatformChartPayload;
  variant: HeaderVariant;
  title: string;
}) {
  const exportKey =
    data.platform === "twitter"
      ? "twitter-engagement"
      : data.platform === "youtube"
        ? "youtube-engagement"
        : undefined;
  return (
    <Slide page={page} title={title}>
      <HeaderBand
        variant={variant}
        icon={data.platform === "online" ? "doc" : data.platform}
        title={title}
        subtitle="Analysis of different engagement for"
        description="Breakdown of the different engagements that occurred on the mentions, including comments, shares, likes etc."
      />
      <div className="flex-1">
        <ReactECharts
          option={donutOption(data.engagementBreakdown ?? [])}
          style={{ height: 420, width: "100%" }}
          opts={{ renderer: "canvas" }}
          onChartReady={(chart) => {
            if (exportKey) chartExportRegistry.set(exportKey, chart);
          }}
        />
      </div>
    </Slide>
  );
}

/* ------------------------------------------------------------------ */
/* Page assembly                                                       */
/* ------------------------------------------------------------------ */

const CHARTDATA_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

const RANK_LABEL: Record<PlatformKey, string> = {
  twitter: "Top X Handles",
  online: "Top Websites",
  youtube: "Top YT Channels",
  instagram: "Top Instagram Handles",
  facebook: "Top Facebook Pages",
};

const POST_LABEL: Partial<Record<PlatformKey, { title: string; subtitle: string }>> = {
  twitter: { title: "Top X Posts", subtitle: "Ordered by Engagement" },
  online: { title: "Top Web Articles", subtitle: "Ordered by Engagement" },
  youtube: { title: "Top YT Videos", subtitle: "Ordered by Engagement" },
  instagram: { title: "Top Instagram Posts", subtitle: "Ordered by Engagement" },
  facebook: { title: "Top Facebook Posts", subtitle: "Ordered by Engagement" },
};

const POST_DESC =
  "These are the Top web pages that mention the selected keywords, ordered by the ranking of the website that contains the page.";

const DIVIDER_TITLE: Record<PlatformKey, string> = {
  twitter: "Analytical Report on X",
  online: "Analytical Report on Web",
  youtube: "Analytical Report on YouTube",
  instagram: "Analytical Report on Instagram",
  facebook: "Analytical Report on Facebook",
};

function CardListSlides({
  data,
  counter,
  title,
  subtitle,
  description,
  items,
  slideKey,
}: {
  data: PlatformChartPayload;
  counter: () => number;
  title: string;
  subtitle: string;
  description: string;
  items: ReactNode[];
  slideKey: string;
}): ReactNode[] {
  if (!items.length) return [];

  return chunk(items, 6).map((group, gi) => {
    const page = counter();
    return (
      <Slide key={`${slideKey}-${gi}`} page={page} title={title}>
        {gi === 0 ? (
          <HeaderBand
            variant="gold"
            icon={data.platform === "online" ? "doc" : data.platform}
            title={title}
            subtitle={subtitle}
            description={description}
          />
        ) : (
          <div style={{ height: 12 }} />
        )}
        <CardGrid>{group}</CardGrid>
      </Slide>
    );
  });
}

function PlatformPostSlides({
  data,
  counter,
}: {
  data: PlatformChartPayload;
  counter: () => number;
}): ReactNode[] {
  const label = POST_LABEL[data.platform];
  if (!label) return [];

  const items: ReactNode[] =
    data.platform === "twitter" ||
    data.platform === "instagram" ||
    data.platform === "facebook"
      ? (data.posts ?? []).map((p, i) => <PostCard key={i} post={p} />)
      : data.platform === "online"
        ? (data.articles ?? []).map((a, i) => <ArticleCard key={i} article={a} />)
        : data.platform === "youtube"
          ? (data.videos ?? []).map((v, i) => <VideoCard key={i} video={v} />)
          : [];

  return CardListSlides({
    data,
    counter,
    title: label.title,
    subtitle: label.subtitle,
    description: POST_DESC,
    items,
    slideKey: `cards-${data.platform}`,
  });
}

function ActorGroupSlides({
  data,
  counter,
}: {
  data: PlatformChartPayload;
  counter: () => number;
}): ReactNode[] {
  if (data.platform !== "twitter" || !data.actorGroups?.length) return [];

  const nodes: ReactNode[] = [];
  for (const group of data.actorGroups) {
    const items = group.posts.map((p, i) => (
      <PostCard key={`${group.id}-${i}`} post={p} />
    ));
    nodes.push(
      ...CardListSlides({
        data,
        counter,
        title: group.title,
        subtitle: "Ordered by Engagement",
        description: POST_DESC,
        items,
        slideKey: `actor-${group.id}`,
      })
    );
  }
  return nodes;
}

function PlatformSection({
  data,
  counter,
}: {
  data: PlatformChartPayload;
  counter: () => number;
}): ReactNode[] {
  const nodes: ReactNode[] = [];
  const platform = data.platform;

  nodes.push(
    <DividerSlide key={`div-${platform}`} page={counter()} title={DIVIDER_TITLE[platform]} />
  );
  nodes.push(
    <PlatformOverviewSlide key={`ov-${platform}`} page={counter()} data={data} />
  );

  if (platform === "twitter") {
    nodes.push(
      <EngagementSlide key="eng-tw" page={counter()} data={data} variant="cyan" title="X - Engagement Analysis" />
    );
  } else if (platform === "youtube") {
    nodes.push(
      <EngagementSlide key="eng-yt" page={counter()} data={data} variant="red" title="YT- Engagement Analysis" />
    );
  }

  // Ranking table (chunks of 6)
  chunk(data.topEntities, 6).forEach((rows, gi) => {
    const page = counter();
    nodes.push(
      <Slide key={`rank-${platform}-${gi}`} page={page} title={RANK_LABEL[platform]}>
        <RankingPage
          data={data}
          platform={platform}
          chunkRows={rows}
          startRank={gi * 6 + 1}
          showHeaderBand={gi === 0}
          bandTitle={RANK_LABEL[platform]}
        />
      </Slide>
    );
  });

  // Post/article/video cards
  nodes.push(...PlatformPostSlides({ data, counter }));

  // Curated actor groups (Twitter/X) — same post-card design, after Top X Posts
  nodes.push(...ActorGroupSlides({ data, counter }));

  return nodes;
}

const DEFAULT_FILTERS: ChartFilters = {
  keyword: "",
  keywordMode: "and",
  searchFields: [...ALL_SEARCH_FIELDS],
  startDate: DEFAULT_START_DATE,
  endDate: DEFAULT_END_DATE,
  reportTitle: DEFAULT_REPORT_TITLE,
};

const filterFieldClass =
  "h-8 rounded border border-[#D1D5DB] bg-white px-2 text-[13px] text-[#111] outline-none focus:border-[#1A4D8C]";


// statics executive summary
const EXECUTIVE_SUMMARY = (totalMentions: number) => {
  return {
    paragraph:
    "Between June 25 and July 12, 2026, social media and web conversations around the Operation Sindoor controversy were analyzed across X, Web, YouTube, Instagram, and Facebook to understand discussion volume, reach, sentiment, and key activity trends.",

  bullets: [
    {
      lead: "Conversation Volume",
      body:
        `A total of ${totalMentions} mentions were tracked across all monitored platforms, with X alone reaching 20.9M users and generating a combined engagement of approximately 16.09 lakh.`
    },
    {
      lead: "Sentiment Overview",
      body:
        "Overall sentiment remained predominantly neutral (62.3%), followed by positive (21.5%) and negative (16.3%). While X and YouTube were largely neutral and factual, Instagram (54% negative) and Facebook (66.7% negative) showed more critical discussions. Web coverage was comparatively positive (50.2%)."
    },
    {
      lead: "Peak Discussion Period",
      body:
        "Conversation volume was concentrated between June 26 and June 28, peaking at nearly 650 mentions on June 27 following the government's first official disclosure of the names of six Operation Sindoor martyrs."
    },
    {
      lead: "Recurring Activity",
      body:
        "After the initial surge, discussion gradually declined, with smaller spikes observed between July 5 and July 9, driven primarily by Defence Ministry statements regarding force readiness."
    }
    ],
  };
};


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


// dummy trending topics
let trendingTopicsdfd:any[] = [
  {
    cluster:
      "FACT-CHECK: MoD says Op Sindoor martyrs were honoured with gallantry awards back in August 2025 — DGMO receipts shut down 'hidden casualties' claim",
    mentions: 47,
    reach: 224000,
    engagement: 18000,
    mix: {
      positive: 66,
      negative: 12,
      neutral: 22,
    },
  },
  {
    cluster:
      "Privilege Motion Against Rajnath Singh: K.C. Venugopal tells Parliament RM's casualty denial was 'a straightforward, clear-cut lie'",
    mentions: 41,
    reach: 187000,
    engagement: 15000,
    mix: {
      positive: 19,
      negative: 58,
      neutral: 23,
    },
  },
  {
    cluster:
      "Clip Was Cut? Full transcript shows Rajnath Singh's July 2025 reply denied only pilot losses, not all Op Sindoor casualties, say defence sources",
    mentions: 33,
    reach: 142000,
    engagement: 11000,
    mix: {
      positive: 57,
      negative: 21,
      neutral: 22,
    },
  },
  {
    cluster:
      'AI-faked video claiming Army Chief "admitted failure" in Operation Sindoor goes viral. Fact-checkers trace it to Pakistan-linked accounts',
    mentions: 26,
    reach: 103000,
    engagement: 8100,
    mix: {
      positive: 41,
      negative: 30,
      neutral: 29,
    },
  },
  {
    cluster:
      "Shiv Sena's Priyanka Chaturvedi breaks ranks with opposition, reminds Parliament that DGMO publicly honoured the six martyrs a year ago",
    mentions: 18,
    reach: 71000,
    engagement: 5200,
    mix: {
      positive: 64,
      negative: 9,
      neutral: 27,
    },
  },
  {
    cluster:
      "Shiv Sena's Priyanka Chaturvedi breaks ranks with opposition, reminds Parliament that DGMO publicly honoured the six martyrs a year ago",
    mentions: 18,
    reach: 71000,
    engagement: 5200,
    mix: {
      positive: 64,
      negative: 9,
      neutral: 27,
    },
  },
].map((item) => ({
  cluster: item.cluster,
  url:"",
  mentions: String(item.mentions),
  reach: formatCompactCount(item.reach),
  engagement: formatCompactCount(item.engagement),
  mix: {
    positive: item.mix.positive,
    negative: item.mix.negative,
    neutral: item.mix.neutral,
  },
})) 

export default function GenerateChartPage() {
  const [draftFilters, setDraftFilters] = useState<ChartFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ChartFilters>(DEFAULT_FILTERS);
  const [meta, setMeta] = useState<ChartMeta | null>(null);
  const [platformData, setPlatformData] = useState<PlatformChartPayload[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummaryPayload | null>(null);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const reportMeta = useMemo(
    () => ({
      reportTitle: meta?.reportTitle || appliedFilters.reportTitle || DEFAULT_REPORT_TITLE,
      dateRangeLabel: formatDateRangeLabel(
        meta?.dateRange.start || appliedFilters.startDate,
        meta?.dateRange.end || appliedFilters.endDate
      ),
    }),
    [meta, appliedFilters]
  );

  const loadData = useCallback(async (filters: ChartFilters, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildAllUrl(CHARTDATA_BASE, filters), { signal });
      if (!res.ok) throw new Error(`Chart API responded with ${res.status}`);
      const json = (await res.json()) as {
        success: boolean;
        data: PlatformChartPayload[];
        meta?: ChartMeta;
        executiveSummary?: ExecutiveSummaryPayload;
        trendingTopics?: TrendingTopicItem[];
      };
      if (!json.success) throw new Error("Chart API returned an error");
      const ordered = PLATFORM_ORDER
        .map((k) => json.data.find((d) => d.platform === k))
        .filter(Boolean) as PlatformChartPayload[];
      setPlatformData(ordered);
      setExecutiveSummary(json.executiveSummary ?? null);
      setTrendingTopics(json.trendingTopics ?? []);
      if (json.meta) {
        const local = describeQueryLocal(filters);
        setMeta({
          ...json.meta,
          keywordMode: json.meta.keywordMode ?? filters.keywordMode,
          searchFields: json.meta.searchFields?.length
            ? json.meta.searchFields
            : filters.searchFields,
          queryType: json.meta.queryType ?? local.queryType,
          queryTypeLabel: json.meta.queryTypeLabel ?? local.queryTypeLabel,
          generatedQuery: json.meta.generatedQuery ?? local.generatedQuery,
        });
      } else {
        setMeta({
          reportTitle: filters.reportTitle.trim() || DEFAULT_REPORT_TITLE,
          keyword: filters.keyword.trim(),
          keywordMode: filters.keywordMode,
          searchFields: filters.searchFields,
          dateRange: { start: filters.startDate, end: filters.endDate },
          ...describeQueryLocal(filters),
        });
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(
        err instanceof Error
          ? `${err.message}. Start chartdata: cd backend && npx tsx src/chartdata.ts`
          : "Failed to load chart data"
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadData(appliedFilters, ac.signal);
    return () => ac.abort();
  }, [appliedFilters, loadData]);

  const applyFilters = () => {
    const fields =
      draftFilters.searchFields.length > 0
        ? draftFilters.searchFields
        : [...ALL_SEARCH_FIELDS];
    const next = {
      ...draftFilters,
      keyword: draftFilters.keyword.trim(),
      keywordMode: draftFilters.keywordMode,
      searchFields: fields,
      reportTitle: draftFilters.reportTitle.trim() || DEFAULT_REPORT_TITLE,
    };
    setDraftFilters(next);
    setAppliedFilters(next);
  };

  const toggleSearchField = (field: SearchFieldKey) => {
    setDraftFilters((f) => {
      const has = f.searchFields.includes(field);
      const nextFields = has
        ? f.searchFields.filter((x) => x !== field)
        : [...f.searchFields, field];
      return { ...f, searchFields: nextFields };
    });
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const pages = useMemo(() => {
    if (!platformData.length) return [];
    let n = 4; // pages 1-4 are cover/overview/exec/trending
    const counter = () => ++n;
    const nodes: ReactNode[] = [];
    for (const data of platformData) {
      nodes.push(...PlatformSection({ data, counter }));
    }
    return nodes;
  }, [platformData]);

  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  return (
    <ReportMetaContext.Provider value={reportMeta}>
      <div className="min-h-screen print:bg-white" style={{ backgroundColor: "#ECEFF3" }}>
        <style
          dangerouslySetInnerHTML={{
            __html: `
        @media print {
          @page { size: 1152px 648px; margin: 0; }
          html, body {
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
          .print-stack {
            gap: 0 !important;
            padding: 0 !important;
            max-width: none !important;
            margin: 0 !important;
          }
          section[data-page] {
            break-after: page;
            page-break-after: always;
            box-shadow: none !important;
            max-width: none !important;
            width: 1152px !important;
            height: 648px !important;
            aspect-ratio: auto !important;
            margin: 0 !important;
            overflow: hidden !important;
          }
          section[data-page] [data-slide-surface] {
            transform: none !important;
            position: relative !important;
            width: 1152px !important;
            height: 648px !important;
          }
        }
      `,
          }}
        />
        <div
          className="sticky top-0 z-20 border-b bg-white px-4 py-3 shadow-sm no-print md:px-6"
          style={{ borderColor: "#D1D5DB" }}
        >
          <div className="mx-auto flex max-w-[1152px] flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SamvadWordmark size={15} />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  disabled={exporting || loading || !platformData.length}
                  title="Export PDF via API"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? "PDF…" : "PDF"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-12 md:items-end">
              <label className="flex flex-col gap-1 md:col-span-3">
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.muted }}>
                  Report title
                </span>
                <input
                  className={filterFieldClass}
                  value={draftFilters.reportTitle}
                  onChange={(e) =>
                    setDraftFilters((f) => ({ ...f, reportTitle: e.target.value }))
                  }
                  placeholder={DEFAULT_REPORT_TITLE}
                />
              </label>
              <label className="flex flex-col gap-1 md:col-span-4">
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.muted }}>
                  Keywords
                </span>
                <input
                  className={filterFieldClass}
                  value={draftFilters.keyword}
                  onChange={(e) =>
                    setDraftFilters((f) => ({ ...f, keyword: e.target.value }))
                  }
                  placeholder='sindoor and (controversy or deaths)'
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                />
              </label>
              <div className="flex flex-col gap-1 md:col-span-2">
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.muted }}>
                  Match
                </span>
                <div className="flex h-8 overflow-hidden rounded border" style={{ borderColor: "#D1D5DB" }}>
                  {(["and", "or"] as KeywordMode[]).map((mode) => {
                    const active = draftFilters.keywordMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setDraftFilters((f) => ({ ...f, keywordMode: mode }))}
                        className="flex-1 text-[12px] font-semibold uppercase tracking-wide"
                        style={{
                          backgroundColor: active ? C.samvad : "#fff",
                          color: active ? "#fff" : "#444",
                        }}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex flex-col gap-1 md:col-span-1">
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.muted }}>
                  Start
                </span>
                <input
                  type="date"
                  className={filterFieldClass}
                  value={draftFilters.startDate}
                  onChange={(e) =>
                    setDraftFilters((f) => ({ ...f, startDate: e.target.value }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 md:col-span-1">
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.muted }}>
                  End
                </span>
                <input
                  type="date"
                  className={filterFieldClass}
                  value={draftFilters.endDate}
                  onChange={(e) =>
                    setDraftFilters((f) => ({ ...f, endDate: e.target.value }))
                  }
                />
              </label>
              <div className="flex items-center gap-2 md:col-span-1 md:justify-end">
                <Button type="button" size="sm" onClick={applyFilters} disabled={loading}>
                  Apply
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.muted }}>
                  Search fields (all media)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-[11px] font-medium hover:underline"
                    style={{ color: C.samvad }}
                    onClick={() =>
                      setDraftFilters((f) => ({ ...f, searchFields: [...ALL_SEARCH_FIELDS] }))
                    }
                  >
                    All
                  </button>
                  <span style={{ color: C.muted }}>·</span>
                  <button
                    type="button"
                    className="text-[11px] font-medium hover:underline"
                    style={{ color: C.samvad }}
                    onClick={() => setDraftFilters((f) => ({ ...f, searchFields: [] }))}
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_SEARCH_FIELDS.map((field) => {
                  const on = draftFilters.searchFields.includes(field);
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() => toggleSearchField(field)}
                      className="rounded border px-2.5 py-1 text-[12px] font-medium transition-colors"
                      style={{
                        borderColor: on ? C.samvad : "#D1D5DB",
                        backgroundColor: on ? "rgba(26,77,140,0.08)" : "#fff",
                        color: on ? C.samvad : "#555",
                      }}
                    >
                      {SEARCH_FIELD_LABELS[field]}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px]" style={{ color: C.muted }}>
                Boolean:{" "}
                <code className="rounded bg-[#F3F4F6] px-1">
                  sindoor and (controversy or deaths)
                </code>
                . Also{" "}
                <code className="rounded bg-[#F3F4F6] px-1">and</code>/
                <code className="rounded bg-[#F3F4F6] px-1">or</code>, parentheses, quotes for phrases.
                Plain comma lists still use the AND/OR toggle. Fields apply to every media.
              </p>
            </div>

            {/* Query note — toolbar only (no-print); not part of report slides */}
            {meta ? (
              <div
                className="rounded-md border px-3 py-2 text-[12px] leading-snug no-print"
                style={{
                  borderColor: "#D6E3F0",
                  backgroundColor: "#F4F8FC",
                  color: "#334155",
                }}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: C.samvad }}
                  >
                    Note
                  </span>
                  <span className="font-semibold" style={{ color: C.samvad }}>
                    Query type:
                  </span>
                  <span>{meta.queryTypeLabel ?? "—"}</span>
                  {meta.queryType ? (
                    <span className="font-mono text-[11px]" style={{ color: C.muted }}>
                      ({meta.queryType})
                    </span>
                  ) : null}
                </div>
                <div className="mt-1">
                  <span className="font-semibold" style={{ color: C.samvad }}>
                    Generated query:
                  </span>{" "}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]" style={{ color: C.ink }}>
                    {meta.generatedQuery || meta.keyword || "(all mentions in date range)"}
                  </code>
                </div>
                <div className="mt-1" style={{ color: C.muted }}>
                  Fields:{" "}
                  {(meta.searchFields ?? appliedFilters.searchFields)
                    .map((f) => SEARCH_FIELD_LABELS[f] ?? f)
                    .join(", ")}
                  {" · "}
                  {reportMeta.dateRangeLabel}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="mx-auto max-w-[1152px] p-10 text-center" style={{ color: C.muted }}>
            Loading SAMVAD dashboard…
          </div>
        ) : null}

        {error ? (
          <div className="mx-auto max-w-[1152px] p-6">
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          </div>
        ) : null}

        {exportError ? (
          <div className="mx-auto max-w-[1152px] px-6 pt-4">
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {exportError}
            </div>
          </div>
        ) : null}

        {!loading && !error ? (
          <div
            ref={printRef}
            className="print-stack mx-auto flex max-w-[1152px] flex-col gap-6 p-4 md:p-6"
          >
            <CoverPage />
            <OverviewSlide platforms={platformData} />
            <ExecutiveSummary summary={EXECUTIVE_SUMMARY(platformData.reduce((acc, curr) => acc + curr.kpis.totalMentions, 0))} />
            <TrendingTopics topics={trendingTopics} />
            <TrendingTopics topics={trendingTopicsdfd} startRank={5} />
            {pages}
          </div>
        ) : null}
      </div>
    </ReportMetaContext.Provider>
  );
}
