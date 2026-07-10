import { NextResponse } from "next/server";
import { queryRecordsPaginated } from "@/services/excel";
import { ENTITY_SLUG_MAP } from "@/constants";
import { normalizeDateRange } from "@/lib/date-range";
import { sanitizeSearchQuery } from "@/lib/search";
import type { DefenceEntity, MediaType, NewsFilters } from "@/types";

function parseFilters(searchParams: URLSearchParams): NewsFilters {
  const filters: NewsFilters = {};

  const entityParam = searchParams.get("entity");
  if (entityParam) {
    const entity =
      ENTITY_SLUG_MAP[entityParam] ?? (entityParam as DefenceEntity);
    filters.entity = entity;
  }

  if (searchParams.get("mediaType"))
    filters.mediaType = searchParams.get("mediaType") as MediaType;
  if (searchParams.get("sentiment"))
    filters.sentiment = searchParams.get("sentiment")!;
  if (searchParams.get("language"))
    filters.language = searchParams.get("language")!;
  if (searchParams.get("publication"))
    filters.publication = searchParams.get("publication")!;
  if (searchParams.get("website"))
    filters.website = searchParams.get("website")!;
  if (searchParams.get("edition"))
    filters.edition = searchParams.get("edition")!;
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseFilters(searchParams);

    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

    const result = queryRecordsPaginated(filters, page, pageSize);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("News API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load news records" },
      { status: 500 }
    );
  }
}
