import type { Request, Response } from "express";
import { queryRecordsPaginated } from "@/services/excel";
import { parseNewsFilters } from "../utils/parse-filters";
import { serializeApiTimestamps } from "@/lib/db/timestamps";

export async function getNews(req: Request, res: Response): Promise<void> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const filters = parseNewsFilters(params);
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const pageSize = parseInt(String(req.query.pageSize ?? "20"), 10);

  const result = await queryRecordsPaginated(filters, page, pageSize);
  res.json(serializeApiTimestamps({ success: true, ...result }));
}
