import { Document } from "@react-pdf/renderer";
import { OverviewPdfPages } from "./OverviewPdfPages";
import { EntityPdfPages } from "./EntityPdfPages";
import type { ReportData } from "@/services/pdf/build-report-data";

interface DefenceReportDocumentProps {
  data: ReportData;
  includeOverview?: boolean;
}

export function DefenceReportDocument({
  data,
  includeOverview = true,
}: DefenceReportDocumentProps) {
  return (
    <Document
      title="Defence Media Intelligence Report"
      author="Defence Sentiment Dashboard"
      subject="Media monitoring and sentiment analysis"
    >
      {includeOverview && (
        <OverviewPdfPages
          overview={data.overview}
          filterSummary={data.filterSummary}
          generatedAt={data.generatedAt}
        />
      )}
      {data.entities.map((section) => (
        <EntityPdfPages
          key={section.slug}
          section={section}
          filterSummary={data.filterSummary}
          generatedAt={data.generatedAt}
        />
      ))}
    </Document>
  );
}
