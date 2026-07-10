import { NextResponse } from "next/server";
import {
  queryEntityAnalytics,
  stripDrillDownFilters,
  hasDrillDownFilters,
} from "@/services/excel";
import { ENTITY_SLUG_MAP } from "@/constants";
import type { DefenceEntity, NewsFilters } from "@/types";
import { normalizeDateRange } from "@/lib/date-range";
import { sanitizeSearchQuery } from "@/lib/search";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity: entitySlug } = await params;
    const entity = ENTITY_SLUG_MAP[entitySlug] as DefenceEntity | undefined;

    if (!entity) {
      return NextResponse.json(
        { success: false, error: "Invalid entity" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filters: NewsFilters = { entity };

    if (searchParams.get("mediaType"))
      filters.mediaType = searchParams.get("mediaType") as NewsFilters["mediaType"];
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

    const kpiFilters = stripDrillDownFilters(filters);
    const kpi = queryEntityAnalytics(kpiFilters, entity);

    const data = hasDrillDownFilters(filters)
      ? queryEntityAnalytics(filters, entity)
      : kpi;

    return NextResponse.json({ success: true, data, kpi });
  } catch (error) {
    console.error("Entity API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load entity analytics" },
      { status: 500 }
    );
  }
}
