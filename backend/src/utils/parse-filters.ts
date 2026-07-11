import type { DefenceEntity, MediaType, NewsFilters } from "@/types";
import { ENTITY_SLUG_MAP } from "@/constants";
import { normalizeDateRange } from "@/lib/date-range";
import { sanitizeSearchQuery } from "@/lib/search";

export function parseNewsFilters(
  searchParams: URLSearchParams,
  options?: { includeEntity?: boolean }
): NewsFilters {
  const filters: NewsFilters = {};

  if (options?.includeEntity !== false) {
    const entityParam = searchParams.get("entity");
    if (entityParam) {
      filters.entity =
        ENTITY_SLUG_MAP[entityParam] ?? (entityParam as DefenceEntity);
    }
  }

  if (searchParams.get("mediaType")) {
    filters.mediaType = searchParams.get("mediaType") as MediaType;
  }
  if (searchParams.get("sentiment")) {
    filters.sentiment = searchParams.get("sentiment")!;
  }
  if (searchParams.get("language")) {
    filters.language = searchParams.get("language")!;
  }
  if (searchParams.get("publication")) {
    filters.publication = searchParams.get("publication")!;
  }
  if (searchParams.get("website")) {
    filters.website = searchParams.get("website")!;
  }
  if (searchParams.get("edition")) {
    filters.edition = searchParams.get("edition")!;
  }
  if (searchParams.get("search")) {
    const sanitized = sanitizeSearchQuery(searchParams.get("search"));
    if (sanitized) filters.search = sanitized;
  }

  const { startDate, endDate } = normalizeDateRange({
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
  });
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  return filters;
}

export function parseNewsFiltersFromBody(
  body: Record<string, unknown>
): NewsFilters {
  const filters: NewsFilters = {};
  const entityParam = body.entity as string | undefined;
  if (entityParam) {
    filters.entity =
      ENTITY_SLUG_MAP[entityParam] ?? (entityParam as DefenceEntity);
  }

  const keys = [
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

  for (const key of keys) {
    const val = body[key];
    if (typeof val === "string" && val) {
      (filters as Record<string, string>)[key] = val;
    }
  }

  const { startDate, endDate } = normalizeDateRange({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  filters.startDate = startDate;
  filters.endDate = endDate;

  return filters;
}
