import { NextResponse } from "next/server";
import { queryConstituencyRecords, queryConstituencyMediaCounts } from "@/services/excel/constituency-query";
import { normalizeDateRange } from "@/lib/date-range";
import { sanitizeSearchQuery } from "@/lib/search";
import { MEDIA_TYPES } from "@/constants";
import type { MediaType } from "@/types";

const LUCKNOW = "Lucknow";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const mediaTypeParam = searchParams.get("mediaType");
    const mediaType = MEDIA_TYPES.includes(mediaTypeParam as MediaType)
      ? (mediaTypeParam as MediaType)
      : undefined;

    const { startDate, endDate } = normalizeDateRange({
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });

    const searchParam = searchParams.get("search");
    const sanitizedSearch = searchParam
      ? sanitizeSearchQuery(searchParam)
      : undefined;

    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);
    const sortBy = searchParams.get("sortBy") ?? "date";
    const sortOrder =
      searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc";

    const countsOnly = searchParams.get("countsOnly") === "true";

    if (countsOnly) {
      const mediaCounts = queryConstituencyMediaCounts({
        constituency: LUCKNOW,
        sentiment: searchParams.get("sentiment") ?? undefined,
        startDate,
        endDate,
        search: sanitizedSearch,
      });
      return NextResponse.json({ success: true, mediaCounts });
    }

    const result = queryConstituencyRecords(
      {
        constituency: LUCKNOW,
        mediaType,
        sentiment: searchParams.get("sentiment") ?? undefined,
        startDate,
        endDate,
        search: sanitizedSearch,
        sortBy,
        sortOrder,
      },
      page,
      pageSize
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Lucknow constituency API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load constituency news" },
      { status: 500 }
    );
  }
}
