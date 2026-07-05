import { NextResponse } from "next/server";
import { generatePdfBuffer } from "@/services/pdf/generate-pdf";
import { ENTITY_SLUG_MAP } from "@/constants";
import type { DefenceEntity, MediaType, NewsFilters } from "@/types";
import { normalizeDateRange } from "@/lib/date-range";

function parseFilters(searchParams: URLSearchParams): NewsFilters {
  const filters: NewsFilters = {};

  const entityParam = searchParams.get("entity");
  if (entityParam) {
    filters.entity =
      ENTITY_SLUG_MAP[entityParam] ?? (entityParam as DefenceEntity);
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
  if (searchParams.get("search"))
    filters.search = searchParams.get("search")!;

  const { startDate, endDate } = normalizeDateRange({
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
  });
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  return filters;
}

function parseFiltersFromBody(body: Record<string, unknown>): NewsFilters {
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

async function buildPdfResponse(
  filters: NewsFilters,
  options: {
    entitySlug?: string | null;
    includeOverview: boolean;
    selectedNewsIds?: string[];
  }
) {
  const entityOnly = filters.entity;

  if (entityOnly && (!options.selectedNewsIds || options.selectedNewsIds.length === 0)) {
    return NextResponse.json(
      {
        success: false,
        error: "Select news rows from the table before exporting PDF",
      },
      { status: 400 }
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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseFilters(searchParams);
    const includeOverview = searchParams.get("includeOverview") !== "false";
    const newsIds = searchParams.getAll("newsIds");

    return buildPdfResponse(filters, {
      entitySlug: searchParams.get("entity"),
      includeOverview: filters.entity ? includeOverview : true,
      selectedNewsIds: newsIds.length > 0 ? newsIds : undefined,
    });
  } catch (error) {
    console.error("PDF export API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate PDF report" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      entity?: string;
      includeOverview?: boolean;
      newsIds?: string[];
      filters?: Record<string, string>;
    };

    const filters = body.filters
      ? parseFiltersFromBody({ entity: body.entity, ...body.filters })
      : parseFiltersFromBody({ entity: body.entity });

    return buildPdfResponse(filters, {
      entitySlug: body.entity ?? null,
      includeOverview: body.includeOverview ?? !body.entity,
      selectedNewsIds: body.newsIds,
    });
  } catch (error) {
    console.error("PDF export API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate PDF report" },
      { status: 500 }
    );
  }
}
