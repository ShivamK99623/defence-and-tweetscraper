import { Page, View } from "@react-pdf/renderer";
import { PdfKpiRow } from "./PdfKpiCard";
import {
  PdfDistributionChart,
  PdfHorizontalBarChart,
  PdfVerticalBarChart,
} from "./PdfCharts";
import { PdfPageFooter, PdfPageHeader } from "./PdfPageChrome";
import { pdfStyles } from "./theme";
import { SENTIMENT_COLORS } from "@/constants";
import type { OverviewAnalytics } from "@/types";
import { overviewDistributionItems } from "@/services/pdf/build-report-data";

interface OverviewPdfPagesProps {
  overview: OverviewAnalytics;
  filterSummary: string;
  generatedAt: string;
}

export function OverviewPdfPages({
  overview,
  filterSummary,
  generatedAt,
}: OverviewPdfPagesProps) {
  const { entityItems, mediaItems } = overviewDistributionItems(overview);

  return (
    <>
      <Page size="A4" style={pdfStyles.page} wrap={false}>
        <PdfPageHeader
          title="National Defence Media Intelligence Overview"
          subtitle={`Real-time sentiment monitoring across print, online, Twitter & YouTube · ${filterSummary}`}
        />
        <View style={pdfStyles.sectionGap}>
          <PdfKpiRow kpis={overview.kpis} showMediaBreakdown />
        </View>
        <View style={[pdfStyles.row, pdfStyles.sectionGap]}>
          <PdfDistributionChart
            title="Defence Entity Distribution"
            subtitle="Coverage by defence entity"
            items={entityItems}
          />
          <PdfDistributionChart
            title="Media Distribution"
            subtitle="Coverage by media type"
            items={mediaItems}
          />
        </View>
        <PdfPageFooter section="Overview" generatedAt={generatedAt} />
      </Page>

      <Page size="A4" style={pdfStyles.page} wrap={false}>
        <PdfPageHeader
          title="Overview — Top News"
          subtitle={filterSummary}
        />
        <View style={[pdfStyles.row, pdfStyles.sectionGap]}>
          <PdfHorizontalBarChart
            title="Top 10 Positive News — Defence Minister"
            subtitle="Twitter & YouTube · ranked by engagement"
            categories={overview.topPositiveNews.map((n) => n.heading)}
            values={overview.topPositiveNews.map((n) => n.engagement)}
            color={SENTIMENT_COLORS.positive}
          />
          <PdfHorizontalBarChart
            title="Top 10 Negative News — Defence Minister"
            subtitle="Twitter & YouTube · ranked by engagement"
            categories={overview.topNegativeNews.map((n) => n.heading)}
            values={overview.topNegativeNews.map((n) => n.engagement)}
            color={SENTIMENT_COLORS.negative}
          />
        </View>
        <PdfPageFooter section="Overview" generatedAt={generatedAt} />
      </Page>

      <Page size="A4" style={pdfStyles.page} wrap={false}>
        <PdfPageHeader
          title="Overview — Coverage Rankings"
          subtitle={filterSummary}
        />
        <View style={[pdfStyles.row, pdfStyles.sectionGap]}>
          <PdfVerticalBarChart
            title="Top 10 Editions"
            subtitle="Print media edition-wise coverage"
            categories={overview.topEditions.map((e) => e.edition)}
            values={overview.topEditions.map((e) => e.count)}
          />
          <PdfVerticalBarChart
            title="Top Online Sources"
            subtitle="Website-wise news count"
            categories={overview.topOnlineSources.map((s) => s.website)}
            values={overview.topOnlineSources.map((s) => s.count)}
            color="#059669"
          />
        </View>
        <PdfPageFooter section="Overview" generatedAt={generatedAt} />
      </Page>
    </>
  );
}
