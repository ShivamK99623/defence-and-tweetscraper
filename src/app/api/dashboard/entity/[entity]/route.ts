import { NextResponse } from "next/server";
import {
  getCachedRecords,
  filterRecords,
  generateEntityAnalytics,
} from "@/services/excel";
import { ENTITY_SLUG_MAP } from "@/constants";
import type { DefenceEntity, NewsFilters } from "@/types";
import { normalizeDateRange } from "@/lib/date-range";

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

    const { startDate, endDate } = normalizeDateRange({
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const records = getCachedRecords();
    const filtered = filterRecords(records, filters);
    const analytics = generateEntityAnalytics(filtered, entity);

    return NextResponse.json({ success: true, data: analytics });
  } catch (error) {
    console.error("Entity API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load entity analytics" },
      { status: 500 }
    );
  }
}
