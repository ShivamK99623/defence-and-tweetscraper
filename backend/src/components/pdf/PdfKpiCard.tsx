import { Text, View } from "@react-pdf/renderer";
import type { KpiCardVariant } from "@/components/cards/AnalyticsCard";
import { KPI_VARIANT_STYLES, pdfStyles } from "./theme";

interface PdfKpiCardProps {
  title: string;
  value: number;
  percent?: number;
  variant?: KpiCardVariant;
  flex?: number;
}

export function PdfKpiCard({
  title,
  value,
  percent,
  variant = "default",
  flex = 1,
}: PdfKpiCardProps) {
  const styles = KPI_VARIANT_STYLES[variant];

  return (
    <View
      style={[
        pdfStyles.kpiCard,
        { borderColor: styles.border, flex },
      ]}
    >
      <View style={[pdfStyles.kpiAccent, { backgroundColor: styles.accent }]} />
      <Text style={pdfStyles.kpiTitle}>{title}</Text>
      <Text style={[pdfStyles.kpiValue, { color: styles.value }]}>
        {value.toLocaleString("en-IN")}
      </Text>
      {percent !== undefined && (
        <Text
          style={[
            pdfStyles.kpiBadge,
            { backgroundColor: styles.badgeBg, color: styles.badgeText },
          ]}
        >
          {percent}%
        </Text>
      )}
    </View>
  );
}

interface PdfKpiRowProps {
  kpis: {
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    positivePercent: number;
    negativePercent: number;
    neutralPercent: number;
    print?: number;
    online?: number;
    twitter?: number;
    youtube?: number;
  };
  showMediaBreakdown?: boolean;
}

export function PdfKpiRow({ kpis, showMediaBreakdown = false }: PdfKpiRowProps) {
  const sentimentCards = [
    { title: "Total News", value: kpis.total, variant: "default" as const },
    {
      title: "Positive",
      value: kpis.positive,
      percent: kpis.positivePercent,
      variant: "positive" as const,
    },
    {
      title: "Negative",
      value: kpis.negative,
      percent: kpis.negativePercent,
      variant: "negative" as const,
    },
    {
      title: "Neutral",
      value: kpis.neutral,
      percent: kpis.neutralPercent,
      variant: "neutral" as const,
    },
  ];

  const mediaCards = showMediaBreakdown
    ? [
        {
          title: "Print",
          value: kpis.print ?? 0,
          percent: kpis.total
            ? Math.round(((kpis.print ?? 0) / kpis.total) * 100)
            : 0,
          variant: "print" as const,
        },
        {
          title: "Online",
          value: kpis.online ?? 0,
          percent: kpis.total
            ? Math.round(((kpis.online ?? 0) / kpis.total) * 100)
            : 0,
          variant: "online" as const,
        },
        {
          title: "Twitter",
          value: kpis.twitter ?? 0,
          percent: kpis.total
            ? Math.round(((kpis.twitter ?? 0) / kpis.total) * 100)
            : 0,
          variant: "twitter" as const,
        },
        {
          title: "YouTube",
          value: kpis.youtube ?? 0,
          percent: kpis.total
            ? Math.round(((kpis.youtube ?? 0) / kpis.total) * 100)
            : 0,
          variant: "youtube" as const,
        },
      ]
    : [];

  const allCards = [...sentimentCards, ...mediaCards];

  return (
    <View style={showMediaBreakdown ? pdfStyles.kpiGrid8 : pdfStyles.kpiGrid4}>
      {allCards.map((card) => (
        <PdfKpiCard
          key={card.title}
          title={card.title}
          value={card.value}
          percent={"percent" in card ? card.percent : undefined}
          variant={card.variant}
          flex={showMediaBreakdown ? 0.23 : 1}
        />
      ))}
    </View>
  );
}
