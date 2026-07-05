"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import type { EChartsOption } from "echarts";
import { ChartContainer } from "./ChartContainer";
import type { TopNewsItem } from "@/types";
import { ENTITY_COLORS, ENTITY_TO_SLUG, MEDIA_COLORS, MEDIA_LABELS, SENTIMENT_COLORS } from "@/constants";
import { formatNumber, truncate, formatShortChartDate } from "@/lib/utils";
import type { DefenceEntity, MediaType } from "@/types";
import { useRouter } from "next/navigation";
import { useFilterStore } from "@/store";
import { useIsMobile } from "@/hooks/useMediaQuery";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center text-slate-400">
      Loading chart...
    </div>
  ),
});

const chartTheme = {
  backgroundColor: "transparent",
  textStyle: { color: "#64748b", fontFamily: "inherit" },
};

const tooltipStyles =
  "max-width: 260px; white-space: normal; word-break: break-word; line-height: 1.45;";

interface EntityDoughnutProps {
  data: { entity: DefenceEntity; count: number }[];
}

export const EntityDoughnutChart = memo(function EntityDoughnutChart({
  data,
}: EntityDoughnutProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const option: EChartsOption = {
    ...chartTheme,
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: isMobile
      ? {
          orient: "horizontal",
          bottom: 0,
          left: "center",
          textStyle: { color: "#475569", fontSize: 10 },
        }
      : {
          orient: "vertical",
          right: 10,
          top: "center",
          textStyle: { color: "#475569", fontSize: 11 },
        },
    series: [
      {
        type: "pie",
        radius: isMobile ? ["38%", "58%"] : ["45%", "70%"],
        center: isMobile ? ["50%", "44%"] : ["35%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: "#ffffff", borderWidth: 2 },
        label: { show: false },
        data: data.map((d) => ({
          name: d.entity,
          value: d.count,
          itemStyle: { color: ENTITY_COLORS[d.entity] },
        })),
      },
    ],
  };

  const onEvents = {
    click: (params: { name: string }) => {
      const slug = ENTITY_TO_SLUG[params.name as DefenceEntity];
      if (slug) router.push(`/${slug}`);
    },
  };

  return (
    <ChartContainer title="Defence Entity Distribution" subtitle="Click to drill down">
      <ReactECharts
        option={option}
        style={{ height: isMobile ? 320 : 280 }}
        onEvents={onEvents}
        opts={{ renderer: "canvas" }}
      />
    </ChartContainer>
  );
});

interface MediaPieProps {
  data: { mediaType: MediaType; count: number }[];
}

export const MediaPieChart = memo(function MediaPieChart({ data }: MediaPieProps) {
  const setFilter = useFilterStore((s) => s.setFilter);
  const router = useRouter();
  const isMobile = useIsMobile();

  const option: EChartsOption = {
    ...chartTheme,
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: isMobile
      ? {
          orient: "horizontal",
          bottom: 0,
          left: "center",
          textStyle: { color: "#475569", fontSize: 10 },
        }
      : {
          orient: "vertical",
          right: 10,
          top: "center",
          textStyle: { color: "#475569", fontSize: 11 },
        },
    series: [
      {
        type: "pie",
        radius: isMobile ? "52%" : "65%",
        center: isMobile ? ["50%", "44%"] : ["35%", "50%"],
        itemStyle: { borderRadius: 4, borderColor: "#ffffff", borderWidth: 2 },
        label: { show: false },
        data: data.map((d) => ({
          name: MEDIA_LABELS[d.mediaType],
          value: d.count,
          itemStyle: { color: MEDIA_COLORS[d.mediaType] },
        })),
      },
    ],
  };

  const onEvents = {
    click: (params: { name: string }) => {
      const mediaType = Object.entries(MEDIA_LABELS).find(
        ([, label]) => label === params.name
      )?.[0] as MediaType | undefined;
      if (mediaType) {
        setFilter("mediaType", mediaType);
        const params2 = new URLSearchParams(window.location.search);
        params2.set("mediaType", mediaType);
        router.replace(`?${params2.toString()}`, { scroll: false });
      }
    },
  };

  return (
    <ChartContainer title="Media Distribution" subtitle="Click to filter by media">
      <ReactECharts
        option={option}
        style={{ height: isMobile ? 320 : 280 }}
        onEvents={onEvents}
        opts={{ renderer: "canvas" }}
      />
    </ChartContainer>
  );
});

interface HorizontalBarProps {
  title: string;
  subtitle?: string;
  items: TopNewsItem[];
  color: string;
}

export const HorizontalBarChart = memo(function HorizontalBarChart({
  title,
  subtitle = "Twitter & YouTube · ranked by engagement · click bar to open",
  items,
  color,
}: HorizontalBarProps) {
  const sorted = [...items].sort((a, b) => a.engagement - b.engagement);
  const isMobile = useIsMobile();
  const labelWidth = isMobile ? 96 : 180;
  const headingLimit = isMobile ? 28 : 45;

  const option: EChartsOption = {
    ...chartTheme,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      confine: true,
      appendToBody: false,
      extraCssText: tooltipStyles,
      formatter: (params: unknown) => {
        const p = (Array.isArray(params) ? params[0] : params) as {
          dataIndex: number;
        };
        const item = sorted[p.dataIndex];
        if (!item) return "";
        const media = MEDIA_LABELS[item.mediaType];
        return [
          `<div style="font-weight:600;margin-bottom:4px;">${truncate(item.heading, 80)}</div>`,
          `<span style="color:#64748b;">Engagement:</span> ${formatNumber(item.engagement)}`,
          `<span style="color:#64748b;">Source:</span> ${media}`,
          item.url ? `<span style="color:#64748b;">Click to open link</span>` : "",
        ]
          .filter(Boolean)
          .join("<br/>");
      },
    },
    grid: { left: "4%", right: "8%", bottom: "3%", top: "3%", containLabel: true },
    xAxis: {
      type: "value",
      name: "Engagement",
      nameTextStyle: { color: "#64748b", fontSize: 11 },
      axisLabel: {
        color: "#64748b",
        formatter: (v: number) => formatNumber(v),
      },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
    },
    yAxis: {
      type: "category",
      data: sorted.map((item) => truncate(item.heading, headingLimit)),
      axisLabel: {
        color: "#475569",
        fontSize: isMobile ? 9 : 10,
        width: labelWidth,
        overflow: "truncate",
      },
    },
    series: [
      {
        type: "bar",
        data: sorted.map((item) => ({
          value: item.engagement,
          itemStyle: {
            color,
            cursor: item.url ? "pointer" : "default",
          },
        })),
        label: {
          show: true,
          position: "right",
          formatter: (p) =>
            formatNumber(typeof p.value === "number" ? p.value : 0),
          color: "#64748b",
          fontSize: 10,
        },
      },
    ],
  };

  const onEvents = {
    click: (params: { dataIndex: number }) => {
      const item = sorted[params.dataIndex];
      if (item?.url) {
        window.open(item.url, "_blank", "noopener,noreferrer");
      }
    },
  };

  return (
    <ChartContainer title={title} subtitle={subtitle} className="overflow-hidden">
      <ReactECharts
        option={option}
        style={{ height: Math.max(320, sorted.length * 36) }}
        onEvents={onEvents}
        opts={{ renderer: "canvas" }}
      />
    </ChartContainer>
  );
});

interface TrendChartProps {
  data: {
    date: string;
    print: number;
    online: number;
    twitter: number;
    youtube: number;
  }[];
}

export const TrendChart = memo(function TrendChart({ data }: TrendChartProps) {
  const total = data.length;
  const visiblePoints = Math.min(45, total);
  const zoomStart =
    total > visiblePoints ? ((total - visiblePoints) / total) * 100 : 0;

  const option: EChartsOption = {
    ...chartTheme,
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [params];
        const first = items[0] as { axisValue?: string; dataIndex?: number };
        const dateLabel = first?.axisValue
          ? formatShortChartDate(String(first.axisValue))
          : "";
        const lines = items.map((p) => {
          const item = p as { seriesName?: string; value?: number; marker?: string };
          return `${item.marker ?? ""} ${item.seriesName}: ${item.value ?? 0}`;
        });
        return [`<strong>${dateLabel}</strong>`, ...lines].join("<br/>");
      },
    },
    legend: {
      data: ["Print", "Online", "Twitter", "YouTube"],
      textStyle: { color: "#475569" },
      bottom: 36,
    },
    grid: { left: "3%", right: "4%", bottom: 88, top: 24, containLabel: true },
    dataZoom: [
      {
        type: "slider",
        xAxisIndex: 0,
        start: zoomStart,
        end: 100,
        height: 28,
        bottom: 4,
        borderColor: "#e2e8f0",
        backgroundColor: "#f8fafc",
        fillerColor: "rgba(19, 136, 8, 0.12)",
        handleStyle: { color: "#138808", borderColor: "#138808" },
        moveHandleStyle: { color: "#138808" },
        textStyle: { color: "#64748b", fontSize: 10 },
        labelFormatter: (idx: number) => {
          const point = data[Math.round(idx)];
          return point ? formatShortChartDate(point.date) : "";
        },
      },
      {
        type: "inside",
        xAxisIndex: 0,
        start: zoomStart,
        end: 100,
        zoomOnMouseWheel: false,
        moveOnMouseMove: true,
        moveOnMouseWheel: true,
      },
    ],
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.map((d) => d.date),
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        rotate: 45,
        hideOverlap: true,
        formatter: (value: string) => formatShortChartDate(value),
      },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#64748b" },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
    },
    series: (
      [
        { key: "print", label: "Print", color: MEDIA_COLORS.print },
        { key: "online", label: "Online", color: MEDIA_COLORS.online },
        { key: "twitter", label: "Twitter", color: MEDIA_COLORS.twitter },
        { key: "youtube", label: "YouTube", color: MEDIA_COLORS.youtube },
      ] as const
    ).map(({ key, label, color }) => ({
      name: label,
      type: "line" as const,
      stack: "Total",
      areaStyle: { opacity: 0.4 },
      emphasis: { focus: "series" as const },
      itemStyle: { color },
      data: data.map((d) => d[key]),
    })),
  };

  return (
    <ChartContainer
      title="Daily Trend Analysis"
      subtitle="Stacked area by media type · scroll or drag slider to explore dates"
    >
      <div className="overflow-x-auto">
        <ReactECharts
          option={option}
          style={{ height: 360, minWidth: Math.max(640, total * 18) }}
          opts={{ renderer: "canvas" }}
        />
      </div>
    </ChartContainer>
  );
});

interface BarChartProps {
  title: string;
  subtitle?: string;
  categories: string[];
  values: number[];
  color?: string;
  onBarClick?: (category: string) => void;
}

export const SimpleBarChart = memo(function SimpleBarChart({
  title,
  subtitle,
  categories,
  values,
  color = "#138808",
  onBarClick,
}: BarChartProps) {
  const isMobile = useIsMobile();

  const option: EChartsOption = {
    ...chartTheme,
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: "3%", right: "4%", bottom: "15%", containLabel: true },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: "#64748b", rotate: 45, fontSize: 10, interval: 0 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#64748b" },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
    },
    series: [
      {
        type: "bar",
        data: values,
        itemStyle: { color, borderRadius: [4, 4, 0, 0] },
      },
    ],
  };

  const onEvents = onBarClick
    ? {
        click: (params: { name: string }) => onBarClick(params.name),
      }
    : undefined;

  return (
    <ChartContainer title={title} subtitle={subtitle}>
      <div className="overflow-x-auto">
        <ReactECharts
          option={option}
          style={{ height: 320, minWidth: isMobile ? 280 : undefined }}
          onEvents={onEvents}
          opts={{ renderer: "canvas" }}
        />
      </div>
    </ChartContainer>
  );
});

interface MediaColumnProps {
  data: { mediaType: MediaType; count: number }[];
}

export const MediaColumnChart = memo(function MediaColumnChart({
  data,
}: MediaColumnProps) {
  const option: EChartsOption = {
    ...chartTheme,
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", top: 16, bottom: 24, containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((d) => MEDIA_LABELS[d.mediaType]),
      axisLabel: {
        color: "#475569",
        fontSize: 11,
        interval: 0,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#64748b" },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 48,
        data: data.map((d) => ({
          value: d.count,
          itemStyle: { color: MEDIA_COLORS[d.mediaType], borderRadius: [4, 4, 0, 0] },
        })),
      },
    ],
  };

  return (
    <ChartContainer title="Media Wise News Count">
      <ReactECharts option={option} style={{ height: 280 }} opts={{ renderer: "canvas" }} />
    </ChartContainer>
  );
});

interface StackedSentimentProps {
  data: {
    mediaType: MediaType;
    positive: number;
    negative: number;
    neutral: number;
  }[];
}

export const SentimentStackedChart = memo(function SentimentStackedChart({
  data,
  variant = "stacked",
}: StackedSentimentProps & { variant?: "stacked" | "grouped" }) {
  const isGrouped = variant === "grouped";
  const option: EChartsOption = {
    ...chartTheme,
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: {
      data: ["Positive", "Negative", "Neutral"],
      bottom: 0,
      left: "center",
      itemGap: 12,
      itemWidth: 14,
      itemHeight: 10,
      textStyle: { color: "#475569", fontSize: 11 },
    },
    grid: { left: "3%", right: "4%", top: 16, bottom: 40, containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((d) => MEDIA_LABELS[d.mediaType]),
      axisLabel: {
        color: "#475569",
        fontSize: 11,
        interval: 0,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#64748b", fontSize: 11 },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
    },
    series: [
      {
        name: "Positive",
        type: "bar",
        ...(isGrouped ? {} : { stack: "sentiment" }),
        barMaxWidth: isGrouped ? 28 : 48,
        data: data.map((d) => d.positive),
        itemStyle: { color: SENTIMENT_COLORS.positive, borderRadius: isGrouped ? [4, 4, 0, 0] : undefined },
      },
      {
        name: "Negative",
        type: "bar",
        ...(isGrouped ? {} : { stack: "sentiment" }),
        barMaxWidth: isGrouped ? 28 : 48,
        data: data.map((d) => d.negative),
        itemStyle: { color: SENTIMENT_COLORS.negative, borderRadius: isGrouped ? [4, 4, 0, 0] : undefined },
      },
      {
        name: "Neutral",
        type: "bar",
        ...(isGrouped ? {} : { stack: "sentiment" }),
        barMaxWidth: isGrouped ? 28 : 48,
        data: data.map((d) => d.neutral),
        itemStyle: { color: SENTIMENT_COLORS.neutral, borderRadius: isGrouped ? [4, 4, 0, 0] : undefined },
      },
    ],
  };

  return (
    <ChartContainer title="Media + Sentiment Analysis">
      <ReactECharts option={option} style={{ height: 300 }} opts={{ renderer: "canvas" }} />
    </ChartContainer>
  );
});

export { SENTIMENT_COLORS };
