import type { Request, Response } from "express";
import { generatePdfBuffer } from "@/services/pdf/generate-pdf";
import {
  parseNewsFilters,
  parseNewsFiltersFromBody,
} from "../utils/parse-filters";
import type { DefenceEntity, NewsFilters } from "@/types";
import { AppError } from "../middleware/error-handler";

async function buildPdfResponse(
  res: Response,
  filters: NewsFilters,
  options: {
    entitySlug?: string | null;
    includeOverview: boolean;
    selectedNewsIds?: string[];
  }
): Promise<void> {
  const entityOnly = filters.entity;

  if (
    entityOnly &&
    (!options.selectedNewsIds || options.selectedNewsIds.length === 0)
  ) {
    throw new AppError(
      400,
      "Select news rows from the table before exporting PDF"
    );
  }

  const { buffer } = await generatePdfBuffer(filters, {
    entityOnly,
    includeOverview: options.includeOverview,
    selectedNewsIds: options.selectedNewsIds,
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = options.entitySlug
    ? `defence-report-${options.entitySlug}-${timestamp}.pdf`
    : `defence-report-${timestamp}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );
  res.send(buffer);
}

export async function exportPdfGet(
  req: Request,
  res: Response
): Promise<void> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "newsIds") continue;
    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const filters = parseNewsFilters(params);
  const includeOverview = req.query.includeOverview !== "false";
  const newsIds = parseNewsIds(req);

  await buildPdfResponse(res, filters, {
    entitySlug: req.query.entity ? String(req.query.entity) : null,
    includeOverview: filters.entity ? includeOverview : true,
    selectedNewsIds: newsIds.length > 0 ? newsIds : undefined,
  });
}

export async function exportPdfPost(
  req: Request,
  res: Response
): Promise<void> {
  const body = req.body as {
    entity?: string;
    includeOverview?: boolean;
    newsIds?: string[];
    filters?: Record<string, string>;
  };

  const filters = body.filters
    ? parseNewsFiltersFromBody({ entity: body.entity, ...body.filters })
    : parseNewsFiltersFromBody({ entity: body.entity });

  await buildPdfResponse(res, filters, {
    entitySlug: body.entity ?? null,
    includeOverview: body.includeOverview ?? !body.entity,
    selectedNewsIds: body.newsIds,
  });
}

function parseNewsIds(req: Request): string[] {
  const raw = req.query.newsIds;
  if (!raw) return [];
  return Array.isArray(raw) ? raw.map(String) : [String(raw)];
}
