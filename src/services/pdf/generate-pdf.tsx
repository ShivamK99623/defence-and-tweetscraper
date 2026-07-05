import { renderToBuffer } from "@react-pdf/renderer";
import { DefenceReportDocument } from "@/components/pdf/DefenceReportDocument";
import {
  buildReportData,
  type ReportData,
} from "@/services/pdf/build-report-data";
import type { DefenceEntity, NewsFilters } from "@/types";

export async function generatePdfBuffer(
  filters: NewsFilters = {},
  options?: {
    entityOnly?: DefenceEntity;
    includeOverview?: boolean;
    selectedNewsIds?: string[];
  }
): Promise<{ buffer: Buffer; data: ReportData }> {
  const data = buildReportData(filters, {
    entityOnly: options?.entityOnly,
    selectedNewsIds: options?.selectedNewsIds,
  });
  const includeOverview =
    options?.includeOverview ?? !options?.entityOnly;

  const buffer = await renderToBuffer(
    <DefenceReportDocument data={data} includeOverview={includeOverview} />
  );

  return { buffer, data };
}
