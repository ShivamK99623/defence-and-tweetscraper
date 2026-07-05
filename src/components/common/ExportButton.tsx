"use client";

import { memo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFilterStore } from "@/store";
import { useExportSelectionStore, countEntitySelections } from "@/store/export-selection-store";
import { ENTITY_TO_SLUG } from "@/constants";
import type { DefenceEntity } from "@/types";

interface ExportButtonProps {
  entity?: DefenceEntity;
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

  const appendFilters = (params: URLSearchParams) => {
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
      if (val) params.set(key, String(val));
    }
  };

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

  const buildExportUrl = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams();
    params.set("format", format);

    if (entity) {
      params.set("entity", ENTITY_TO_SLUG[entity]);
    }

    appendFilters(params);
    return `/api/export?${params.toString()}`;
  };

  const handlePdfExport = async () => {
    if (entity && selectionCount === 0) {
      window.alert(
        "Select news rows from the table (checkboxes) before exporting PDF."
      );
      return;
    }

    setIsExportingPdf(true);
    try {
      const newsIds = entitySlug
        ? useExportSelectionStore.getState().getSelectedIds(entitySlug)
        : undefined;

      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: entitySlug,
          includeOverview: !entitySlug,
          newsIds,
          filters: buildFilterPayload(),
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error ?? "PDF export failed");
      }

      const blob = await response.blob();
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = entitySlug
        ? `defence-report-${entitySlug}-${timestamp}.pdf`
        : `defence-report-${timestamp}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to export PDF"
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {entity && selectionCount > 0 && (
        <span className="text-xs text-slate-500">
          {selectionCount} selected for PDF
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handlePdfExport}
        disabled={isExportingPdf || (Boolean(entity) && selectionCount === 0)}
        title={
          entity && selectionCount === 0
            ? "Select news rows from the table first"
            : "Export PDF report"
        }
      >
        <Download className="h-4 w-4" />
        {isExportingPdf ? "PDF…" : "PDF"}
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={buildExportUrl("csv")} download>
          <Download className="h-4 w-4" />
          CSV
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={buildExportUrl("xlsx")} download>
          <Download className="h-4 w-4" />
          XLSX
        </a>
      </Button>
    </div>
  );
});
