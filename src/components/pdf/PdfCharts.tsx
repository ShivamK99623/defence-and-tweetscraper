import { G, Svg, Text } from "@react-pdf/renderer";
import { PdfChartContainer } from "./PdfChartContainer";
import { PDF_COLORS } from "./theme";
import { MEDIA_COLORS, MEDIA_LABELS, SENTIMENT_COLORS } from "@/constants";
import type { MediaType } from "@/types";
import {
  A4_CONTENT_WIDTH,
  BarRect,
  barHeight,
  defaultPadding,
  niceMax,
  svgLabel,
  truncateLabel,
  ValueLabel,
  YAxisGrid,
} from "./chart-utils";

interface VerticalBarChartProps {
  title: string;
  subtitle?: string;
  categories: string[];
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function PdfVerticalBarChart({
  title,
  subtitle,
  categories,
  values,
  color = PDF_COLORS.defenceGreen,
  width = (A4_CONTENT_WIDTH - 10) / 2,
  height = 200,
}: VerticalBarChartProps) {
  const padding = defaultPadding(48);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...values, 1);
  const axisMax = niceMax(maxVal);
  const barGap = 8;
  const barWidth = Math.max(
    10,
    (chartW - barGap * Math.max(categories.length - 1, 0)) /
      Math.max(categories.length, 1)
  );

  return (
    <PdfChartContainer title={title} subtitle={subtitle}>
      <Svg width={width} height={height}>
        <YAxisGrid
          width={width}
          height={height}
          padding={padding}
          maxValue={maxVal}
        />
        {categories.map((cat, i) => {
          const val = values[i] ?? 0;
          const h = barHeight(val, maxVal, chartH);
          const x = padding.left + i * (barWidth + barGap);
          const y = padding.top + chartH - h;
          return (
            <G key={`${cat}-${i}`}>
              <BarRect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                color={color}
              />
              <ValueLabel x={x + barWidth / 2} y={y - 4} value={val} />
              <Text
                {...svgLabel(
                  x + barWidth / 2,
                  padding.top + chartH + 10,
                  PDF_COLORS.slate600,
                  6,
                  "middle"
                )}
              >
                {truncateLabel(cat, 12)}
              </Text>
            </G>
          );
        })}
      </Svg>
    </PdfChartContainer>
  );
}

interface RankedHorizontalChartProps {
  title: string;
  subtitle?: string;
  categories: string[];
  values: number[];
  color?: string;
  width?: number;
}

export function PdfRankedHorizontalChart({
  title,
  subtitle,
  categories,
  values,
  color = PDF_COLORS.defenceGreen,
  width = (A4_CONTENT_WIDTH - 10) / 2,
}: RankedHorizontalChartProps) {
  const rowH = 18;
  const labelW = 92;
  const padding = { top: 8, right: 36, bottom: 8, left: 8 };
  const chartW = width - labelW - padding.left - padding.right;
  const maxVal = Math.max(...values, 1);
  const height = Math.max(categories.length * rowH + padding.top + padding.bottom, 120);

  return (
    <PdfChartContainer title={title} subtitle={subtitle}>
      <Svg width={width} height={height}>
        {categories.map((cat, i) => {
          const val = values[i] ?? 0;
          const barW = (val / niceMax(maxVal)) * chartW;
          const y = padding.top + i * rowH;
          return (
            <G key={`${cat}-${i}`}>
              <Text {...svgLabel(padding.left, y + 11, PDF_COLORS.slate600, 7)}>
                {truncateLabel(cat, 18)}
              </Text>
              <BarRect
                x={padding.left + labelW}
                y={y + 2}
                width={barW}
                height={12}
                color={color}
              />
              <Text
                {...svgLabel(
                  padding.left + labelW + barW + 4,
                  y + 11,
                  PDF_COLORS.slate500,
                  7,
                  "start"
                )}
              >
                {String(val)}
              </Text>
            </G>
          );
        })}
      </Svg>
    </PdfChartContainer>
  );
}

interface MediaColumnChartProps {
  data: { mediaType: MediaType; count: number }[];
}

export function PdfMediaColumnChart({ data }: MediaColumnChartProps) {
  const width = A4_CONTENT_WIDTH;
  const height = 210;
  const padding = defaultPadding(42);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const barGap = 28;
  const barWidth = Math.min(
    56,
    (chartW - barGap * (data.length - 1)) / Math.max(data.length, 1)
  );
  const groupWidth = data.length * barWidth + (data.length - 1) * barGap;
  const startX = padding.left + (chartW - groupWidth) / 2;

  return (
    <PdfChartContainer title="Media Wise News Count">
      <Svg width={width} height={height}>
        <YAxisGrid
          width={width}
          height={height}
          padding={padding}
          maxValue={maxVal}
        />
        {data.map((item, i) => {
          const h = barHeight(item.count, maxVal, chartH);
          const x = startX + i * (barWidth + barGap);
          const y = padding.top + chartH - h;
          return (
            <G key={item.mediaType}>
              <BarRect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                color={MEDIA_COLORS[item.mediaType]}
              />
              <ValueLabel x={x + barWidth / 2} y={y - 4} value={item.count} />
              <Text
                {...svgLabel(
                  x + barWidth / 2,
                  padding.top + chartH + 14,
                  PDF_COLORS.slate600,
                  8,
                  "middle"
                )}
              >
                {MEDIA_LABELS[item.mediaType]}
              </Text>
            </G>
          );
        })}
      </Svg>
    </PdfChartContainer>
  );
}

interface SentimentBreakdownProps {
  data: {
    mediaType: MediaType;
    positive: number;
    negative: number;
    neutral: number;
  }[];
}

export function PdfSentimentGroupedChart({ data }: SentimentBreakdownProps) {
  const width = A4_CONTENT_WIDTH;
  const height = 230;
  const padding = defaultPadding(52);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(
    ...data.flatMap((d) => [d.positive, d.negative, d.neutral]),
    1
  );
  const groupGap = 24;
  const barGap = 4;
  const groupWidth =
    (chartW - groupGap * (data.length - 1)) / Math.max(data.length, 1);
  const barWidth = Math.min(32, (groupWidth - barGap * 2) / 3);

  const series = [
    { key: "positive" as const, label: "Positive", color: SENTIMENT_COLORS.positive },
    { key: "negative" as const, label: "Negative", color: SENTIMENT_COLORS.negative },
    { key: "neutral" as const, label: "Neutral", color: SENTIMENT_COLORS.neutral },
  ];

  return (
    <PdfChartContainer title="Media + Sentiment Analysis">
      <Svg width={width} height={height}>
        <YAxisGrid
          width={width}
          height={height}
          padding={padding}
          maxValue={maxVal}
        />
        {data.map((item, gi) => {
          const groupX =
            padding.left +
            gi * (groupWidth + groupGap) +
            (groupWidth - (barWidth * 3 + barGap * 2)) / 2;
          return (
            <G key={item.mediaType}>
              {series.map((s, si) => {
                const val = item[s.key];
                const h = barHeight(val, maxVal, chartH);
                const x = groupX + si * (barWidth + barGap);
                const y = padding.top + chartH - h;
                return (
                  <G key={s.key}>
                    <BarRect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={h}
                      color={s.color}
                    />
                    <ValueLabel x={x + barWidth / 2} y={y - 4} value={val} />
                  </G>
                );
              })}
              <Text
                {...svgLabel(
                  groupX + (barWidth * 3 + barGap * 2) / 2,
                  padding.top + chartH + 14,
                  PDF_COLORS.slate600,
                  8,
                  "middle"
                )}
              >
                {MEDIA_LABELS[item.mediaType]}
              </Text>
            </G>
          );
        })}
        {series.map((s, i) => (
          <G key={s.label}>
            <BarRect
              x={padding.left + i * 88}
              y={height - 22}
              width={10}
              height={10}
              color={s.color}
            />
            <Text
              {...svgLabel(
                padding.left + i * 88 + 14,
                height - 14,
                PDF_COLORS.slate600,
                8
              )}
            >
              {s.label}
            </Text>
          </G>
        ))}
      </Svg>
    </PdfChartContainer>
  );
}

export function PdfHorizontalBarChart({
  title,
  subtitle,
  categories,
  values,
  color,
}: {
  title: string;
  subtitle?: string;
  categories: string[];
  values: number[];
  color: string;
}) {
  return (
    <PdfRankedHorizontalChart
      title={title}
      subtitle={subtitle}
      categories={categories}
      values={values}
      color={color}
      width={(A4_CONTENT_WIDTH - 10) / 2}
    />
  );
}

export function PdfDistributionChart({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: { label: string; value: number; color: string }[];
}) {
  return (
    <PdfRankedHorizontalChart
      title={title}
      subtitle={subtitle}
      categories={items.map((i) => i.label)}
      values={items.map((i) => i.value)}
      color={items[0]?.color ?? PDF_COLORS.defenceGreen}
      width={(A4_CONTENT_WIDTH - 10) / 2}
    />
  );
}
