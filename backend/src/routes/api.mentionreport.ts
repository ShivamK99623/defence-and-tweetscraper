
import { Router } from "express";
import { asyncHandler } from "../middleware/error-handler";
import { getAllPlatformChartDataHandler } from "@/controllers/mentionreport.controller";

const router = Router();

router.get("/all", asyncHandler(getAllPlatformChartDataHandler));

export default router;

