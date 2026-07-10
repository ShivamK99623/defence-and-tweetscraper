import type { NewsFilters } from "@/types";

/** KPI cards ignore sentiment/media drill-downs; search stays as a global filter. */
export function stripDrillDownFilters(filters: NewsFilters): NewsFilters {
  const next = { ...filters };
  delete next.mediaType;
  delete next.sentiment;
  return next;
}

export function hasDrillDownFilters(filters: NewsFilters): boolean {
  return Boolean(filters.mediaType || filters.sentiment);
}
