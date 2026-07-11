import type { Request, Response } from "express";
import {
  queryConstituencyMediaCounts,
  queryConstituencyRecords,
} from "@/services/excel/constituency-query";
import { normalizeDateRange } from "@/lib/date-range";
import { sanitizeSearchQuery } from "@/lib/search";
import { serializeApiTimestamps } from "@/lib/db/timestamps";
import { MEDIA_TYPES } from "@/constants";
import type { MediaType } from "@/types";

const LUCKNOW = "Lucknow";

export async function getLucknowConstituency(
  req: Request,
  res: Response
): Promise<void> {
  const mediaTypeParam = req.query.mediaType
    ? String(req.query.mediaType)
    : undefined;
  const mediaType = MEDIA_TYPES.includes(mediaTypeParam as MediaType)
    ? (mediaTypeParam as MediaType)
    : undefined;

  const { startDate, endDate } = normalizeDateRange({
    startDate: req.query.startDate ? String(req.query.startDate) : undefined,
    endDate: req.query.endDate ? String(req.query.endDate) : undefined,
  });

  const sanitizedSearch = req.query.search
    ? sanitizeSearchQuery(String(req.query.search))
    : undefined;

  const page = parseInt(String(req.query.page ?? "1"), 10);
  const pageSize = parseInt(String(req.query.pageSize ?? "20"), 10);
  const sortBy = req.query.sortBy ? String(req.query.sortBy) : "date";
  const sortOrder =
    String(req.query.sortOrder ?? "desc").toLowerCase() === "asc"
      ? "asc"
      : "desc";

  if (req.query.countsOnly === "true") {
    const mediaCounts = await queryConstituencyMediaCounts({
      constituency: LUCKNOW,
      sentiment: req.query.sentiment
        ? String(req.query.sentiment)
        : undefined,
      startDate,
      endDate,
      search: sanitizedSearch,
    });
    res.json(serializeApiTimestamps({ success: true, mediaCounts }));
    return;
  }

  const result = await queryConstituencyRecords(
    {
      constituency: LUCKNOW,
      mediaType,
      sentiment: req.query.sentiment
        ? String(req.query.sentiment)
        : undefined,
      startDate,
      endDate,
      search: sanitizedSearch,
      sortBy,
      sortOrder,
    },
    page,
    pageSize
  );

  res.json(serializeApiTimestamps({ success: true, ...result }));
}
