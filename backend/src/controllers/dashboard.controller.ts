import type { Request, Response } from "express";
import {
  queryOverviewAnalytics,
  queryEntityAnalytics,
  stripDrillDownFilters,
  hasDrillDownFilters,
} from "@/services/excel";
import { ENTITY_SLUG_MAP } from "@/constants";
import { parseNewsFilters } from "../utils/parse-filters";
import { serializeApiTimestamps } from "@/lib/db/timestamps";
import type { DefenceEntity, NewsFilters } from "@/types";
import { sanitizeSearchQuery } from "@/lib/search";
import { normalizeDateRange } from "@/lib/date-range";
import { AppError } from "../middleware/error-handler";

export async function getOverview(req: Request, res: Response): Promise<void> {
  const filters: NewsFilters = {};

  if (req.query.mediaType) {
    filters.mediaType = String(req.query.mediaType) as NewsFilters["mediaType"];
  }
  if (req.query.sentiment) {
    filters.sentiment = String(req.query.sentiment);
  }
  if (req.query.search) {
    const sanitized = sanitizeSearchQuery(String(req.query.search));
    if (sanitized) filters.search = sanitized;
  }

  const { startDate, endDate } = normalizeDateRange({
    startDate: req.query.startDate ? String(req.query.startDate) : undefined,
    endDate: req.query.endDate ? String(req.query.endDate) : undefined,
  });
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const analytics = await queryOverviewAnalytics(filters);
  res.json(
    serializeApiTimestamps({
      success: true,
      data: analytics,
      kpi: analytics,
    })
  );
}

export async function getEntityAnalytics(
  req: Request,
  res: Response
): Promise<void> {
  const entitySlug = req.params.entity;
  const entity = ENTITY_SLUG_MAP[entitySlug] as DefenceEntity | undefined;

  if (!entity) {
    throw new AppError(404, "Invalid entity");
  }

  const filters: NewsFilters = { entity, ...parseNewsFiltersFromQuery(req) };
  const kpiFilters = stripDrillDownFilters(filters);
  const kpi = await queryEntityAnalytics(kpiFilters, entity);
  const data = hasDrillDownFilters(filters)
    ? await queryEntityAnalytics(filters, entity)
    : kpi;

  res.json(
    serializeApiTimestamps({
      success: true,
      data,
      kpi,
    })
  );
}

function parseNewsFiltersFromQuery(req: Request): NewsFilters {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string") {
      params.set(key, value);
    }
  }
  return parseNewsFilters(params, { includeEntity: false });
}
