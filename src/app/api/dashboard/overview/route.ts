import { NextResponse } from "next/server";
import {
  getCachedRecords,
  filterRecords,
  generateOverviewAnalytics,
} from "@/services/excel";
import type { NewsFilters } from "@/types";
import { normalizeDateRange } from "@/lib/date-range";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters: NewsFilters = {};

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
    const analytics = generateOverviewAnalytics(filtered);

    return NextResponse.json({ success: true, data: analytics });
  } catch (error) {
    console.error("Overview API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load overview analytics" },
      { status: 500 }
    );
  }
}
