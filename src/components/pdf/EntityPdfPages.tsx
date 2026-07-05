import { Page, Text, View } from "@react-pdf/renderer";
import { PdfKpiRow } from "./PdfKpiCard";
import {
  PdfMediaColumnChart,
  PdfRankedHorizontalChart,
  PdfSentimentGroupedChart,
} from "./PdfCharts";
import {
  chunkRecords,
  getMediaTableTitle,
  PdfNewsTable,
  PDF_TABLE_ROWS_PER_PAGE,
} from "./PdfNewsTable";
import { PdfPageFooter, PdfPageHeader } from "./PdfPageChrome";
import { pdfStyles, PDF_COLORS } from "./theme";
import { A4_CONTENT_WIDTH } from "./chart-utils";
import { MEDIA_TYPES } from "@/constants";
import type { EntityReportSection } from "@/services/pdf/build-report-data";
import { entityKpisFromAnalytics } from "@/services/pdf/build-report-data";

interface EntityPdfPagesProps {
  section: EntityReportSection;
  filterSummary: string;
  generatedAt: string;
}

export function EntityPdfPages({
  section,
  filterSummary,
  generatedAt,
}: EntityPdfPagesProps) {
  const { analytics, entity, title } = section;
  const kpis = entityKpisFromAnalytics(analytics);
  const hasPrintCharts =
    analytics.topPublications.length > 0 || analytics.topEditions.length > 0;

  return (
    <>
      <Page size="A4" style={pdfStyles.page} wrap={false}>
        <PdfPageHeader
          title={title}
          subtitle={`Sentiment analysis and media monitoring for ${entity} · ${filterSummary}`}
        />
        <View style={pdfStyles.sectionGap}>
          <PdfKpiRow kpis={kpis} showMediaBreakdown={false} />
        </View>
        <PdfPageFooter section={entity} generatedAt={generatedAt} />
      </Page>

      <Page size="A4" style={pdfStyles.page} wrap={false}>
        <PdfPageHeader title={title} subtitle="Media coverage breakdown" />
        <PdfMediaColumnChart data={analytics.mediaWiseCount} />
        <PdfPageFooter section={entity} generatedAt={generatedAt} />
      </Page>

      <Page size="A4" style={pdfStyles.page} wrap={false}>
        <PdfPageHeader title={title} subtitle="Sentiment by media type" />
        <PdfSentimentGroupedChart data={analytics.mediaSentimentBreakdown} />
        <PdfPageFooter section={entity} generatedAt={generatedAt} />
      </Page>

      {hasPrintCharts && (
        <Page size="A4" style={pdfStyles.page} wrap={false}>
          <PdfPageHeader
            title={title}
            subtitle="Print media analytics · Top publications and editions"
          />
          <View style={pdfStyles.row}>
            {analytics.topPublications.length > 0 && (
              <View style={{ width: (A4_CONTENT_WIDTH - 8) / 2 }}>
                <PdfRankedHorizontalChart
                  title="Top Publications"
                  subtitle="Print media only"
                  categories={analytics.topPublications.map((p) => p.publication)}
                  values={analytics.topPublications.map((p) => p.count)}
                  color={PDF_COLORS.defenceGreen}
                  width={(A4_CONTENT_WIDTH - 8) / 2}
                />
              </View>
            )}
            {analytics.topEditions.length > 0 && (
              <View style={{ width: (A4_CONTENT_WIDTH - 8) / 2 }}>
                <PdfRankedHorizontalChart
                  title="Top Editions"
                  subtitle="Print media only"
                  categories={analytics.topEditions.map((e) => e.edition)}
                  values={analytics.topEditions.map((e) => e.count)}
                  color={PDF_COLORS.defenceGreen}
                  width={(A4_CONTENT_WIDTH - 8) / 2}
                />
              </View>
            )}
          </View>
          <PdfPageFooter section={entity} generatedAt={generatedAt} />
        </Page>
      )}

      {MEDIA_TYPES.flatMap((mediaType) => {
        const records = section.newsByMedia[mediaType];
        if (records.length === 0) return [];

        const chunks = chunkRecords(records, PDF_TABLE_ROWS_PER_PAGE);

        return chunks.map((chunk, chunkIndex) => {
          const startSerial = chunkIndex * PDF_TABLE_ROWS_PER_PAGE + 1;
          const pageLabel =
            chunks.length > 1
              ? `${getMediaTableTitle(mediaType, records.length)} · Page ${chunkIndex + 1}/${chunks.length}`
              : getMediaTableTitle(mediaType, records.length);

          return (
            <Page
              key={`${section.slug}-${mediaType}-${chunkIndex}`}
              size="A4"
              style={pdfStyles.page}
              wrap={false}
            >
              <PdfPageHeader
                title={title}
                subtitle={`Selected news · ${pageLabel} · ${filterSummary}`}
              />
              <Text style={pdfStyles.tableSectionTitle}>{pageLabel}</Text>
              <PdfNewsTable
                mediaType={mediaType}
                records={chunk}
                startSerial={startSerial}
              />
              <PdfPageFooter section={entity} generatedAt={generatedAt} />
            </Page>
          );
        });
      })}
    </>
  );
}
