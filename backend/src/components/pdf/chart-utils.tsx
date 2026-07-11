import { G, Line, Rect, Text } from "@react-pdf/renderer";
import { PDF_COLORS } from "./theme";

export const A4_CONTENT_WIDTH = 531;

export function svgLabel(
  x: number,
  y: number,
  fill: string,
  fontSize: number,
  textAnchor?: "start" | "middle" | "end" | "inherit"
) {
  return {
    x,
    y,
    style: { fontSize, fill },
    ...(textAnchor ? { textAnchor } : {}),
  };
}

export function truncateLabel(label: string, max = 14): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

export function niceMax(value: number): number {
  if (value <= 0) return 5;
  if (value <= 5) return 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

export function getYTicks(maxValue: number, tickCount = 4): number[] {
  const max = niceMax(maxValue);
  const step = max / tickCount;
  return Array.from({ length: tickCount + 1 }, (_, i) => Math.round(step * i));
}

interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function defaultPadding(bottom = 40): ChartPadding {
  return { top: 12, right: 16, bottom, left: 36 };
}

export function YAxisGrid({
  width,
  height,
  padding,
  maxValue,
  tickCount = 4,
}: {
  width: number;
  height: number;
  padding: ChartPadding;
  maxValue: number;
  tickCount?: number;
}) {
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const ticks = getYTicks(maxValue, tickCount);
  const axisMax = ticks[ticks.length - 1] || 1;

  return (
    <>
      {ticks.map((tick) => {
        const y = padding.top + chartH - (tick / axisMax) * chartH;
        return (
          <G key={tick}>
            <Line
              x1={padding.left}
              y1={y}
              x2={padding.left + chartW}
              y2={y}
              stroke={PDF_COLORS.slate200}
              strokeWidth={1}
            />
            <Text
              {...svgLabel(padding.left - 4, y + 3, PDF_COLORS.slate500, 7, "end")}
            >
              {String(tick)}
            </Text>
          </G>
        );
      })}
      <Line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + chartH}
        stroke={PDF_COLORS.slate600}
        strokeWidth={1}
      />
      <Line
        x1={padding.left}
        y1={padding.top + chartH}
        x2={padding.left + chartW}
        y2={padding.top + chartH}
        stroke={PDF_COLORS.slate600}
        strokeWidth={1}
      />
    </>
  );
}

export function barHeight(value: number, maxValue: number, chartH: number): number {
  const axisMax = niceMax(maxValue);
  return (value / axisMax) * chartH;
}

export function ValueLabel({
  x,
  y,
  value,
  anchor = "middle",
}: {
  x: number;
  y: number;
  value: number;
  anchor?: "start" | "middle" | "end";
}) {
  if (value <= 0) return null;
  return (
    <Text {...svgLabel(x, y, PDF_COLORS.slate600, 7, anchor)}>
      {String(value)}
    </Text>
  );
}

export function BarRect({
  x,
  y,
  width,
  height,
  color,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}) {
  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={Math.max(height, height > 0 ? 3 : 0)}
      fill={color}
      rx={3}
    />
  );
}
