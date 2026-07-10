import { NextResponse } from "next/server";
import { queryOverviewAnalytics } from "@/services/excel";
import type { NewsFilters } from "@/types";
import { normalizeDateRange } from "@/lib/date-range";
import { sanitizeSearchQuery } from "@/lib/search";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters: NewsFilters = {};

    if (searchParams.get("mediaType"))
      filters.mediaType = searchParams.get("mediaType") as NewsFilters["mediaType"];
    if (searchParams.get("sentiment"))
      filters.sentiment = searchParams.get("sentiment")!;
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

    const analytics = queryOverviewAnalytics(filters);

    return NextResponse.json({ success: true, data: analytics, kpi: analytics });
  } catch (error) {
    console.error("Overview API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load overview analytics" },
      { status: 500 }
    );
  }
}
