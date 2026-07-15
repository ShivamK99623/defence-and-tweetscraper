import { NextFunction, type Request, type Response } from "express";
import {
  buildChartMeta,
  buildExecutiveSummary,
  buildTrendingTopics,
  getAllPlatformChartData,
  parseChartFiltersFromQuery,
} from "@/services/mentions/mentionreport";

export async function getAllPlatformChartDataHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filters = parseChartFiltersFromQuery(req.query);
    const data = await getAllPlatformChartData(filters);
    res.json({
      success: true,
      meta: buildChartMeta(filters),
      executiveSummary: await buildExecutiveSummary(filters, data),
      trendingTopics: await buildTrendingTopics(filters),
      data,
    });
  } catch (error) {
    next(error);
  }
}
