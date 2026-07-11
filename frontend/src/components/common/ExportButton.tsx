"use client";

import { memo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFilterStore } from "@/store";
import {
  useExportSelectionStore,
  countEntitySelections,
} from "@/store/export-selection-store";
import { ENTITY_TO_SLUG } from "@/constants";
import { api, isApiError } from "@/lib/api";
import type { DefenceEntity } from "@/types";

interface ExportButtonProps {
  entity?: DefenceEntity;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const ExportButton = memo(function ExportButton({
  entity,
}: ExportButtonProps) {
  const filters = useFilterStore();
  const entitySlug = entity ? ENTITY_TO_SLUG[entity] : undefined;
  const selectionCount = useExportSelectionStore((s) =>
    entitySlug ? countEntitySelections(s.selectedIds, entitySlug) : 0
  );
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingTable, setIsExportingTable] = useState(false);
  const selectionRequired = Boolean(entity);
  const exportDisabled = selectionRequired && selectionCount === 0;

  const buildFilterPayload = () => {
    const payload: Record<string, string> = {};
    const filterKeys = [
      "mediaType",
      "sentiment",
      "language",
      "publication",
      "website",
      "edition",
      "startDate",
      "endDate",
      "search",
    ] as const;

    for (const key of filterKeys) {
      const val = filters[key];
      if (val) payload[key] = String(val);
    }
    return payload;
  };

  const buildExportQuery = (format: "csv" | "xlsx") => {
    const query: Record<string, string | undefined> = {
      format,
      ...buildFilterPayload(),
    };

    if (entity) {
      query.entity = ENTITY_TO_SLUG[entity];
    }

    return query;
  };

  const downloadExport = async (format: "csv" | "xlsx") => {
    if (exportDisabled) return;
    setIsExportingTable(true);
    try {
      const newsIds = entitySlug
        ? useExportSelectionStore.getState().getSelectedIds(entitySlug)
        : [];

      const blob = await api.getBlob("/api/export", {
        query: {
          ...buildExportQuery(format),
          ...(newsIds.length > 0 ? { newsIds } : {}),
        },
      });
      const timestamp = new Date().toISOString().slice(0, 10);
      triggerBlobDownload(blob, `defence-news-export-${timestamp}.${format}`);
    } catch (error) {
      window.alert(
        isApiError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to export"
      );
    } finally {
      setIsExportingTable(false);
    }
  };

  const handlePdfExport = async () => {
    if (exportDisabled) {
      window.alert(
        "Select news rows from the table (checkboxes) before exporting."
      );
      return;
    }

    setIsExportingPdf(true);
    try {
      const newsIds = entitySlug
        ? useExportSelectionStore.getState().getSelectedIds(entitySlug)
        : undefined;

      const blob = await api.postBlob("/api/export/pdf", {
        entity: entitySlug,
        includeOverview: !entitySlug,
        newsIds,
        filters: buildFilterPayload(),
      });

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = entitySlug
        ? `defence-report-${entitySlug}-${timestamp}.pdf`
        : `defence-report-${timestamp}.pdf`;

      triggerBlobDownload(blob, filename);
    } catch (error) {
      window.alert(
        isApiError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to export PDF"
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const selectionTitle =
    exportDisabled ? "Select news rows from the table first" : undefined;
  const busy = isExportingPdf || isExportingTable;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {entity && selectionCount > 0 && (
        <span className="text-xs text-slate-500">
          {selectionCount} selected
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handlePdfExport}
        disabled={busy || exportDisabled}
        title={selectionTitle ?? "Export PDF report"}
      >
        <Download className="h-4 w-4" />
        {isExportingPdf ? "PDF…" : "PDF"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void downloadExport("csv")}
        disabled={busy || exportDisabled}
        title={selectionTitle ?? "Export selected rows as CSV"}
      >
        <Download className="h-4 w-4" />
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void downloadExport("xlsx")}
        disabled={busy || exportDisabled}
        title={selectionTitle ?? "Export selected rows as XLSX"}
      >
        <Download className="h-4 w-4" />
        XLSX
      </Button>
    </div>
  );
});
