import { Router } from "express";
import {
  getEntityAnalytics,
  getOverview,
} from "../controllers/dashboard.controller";
import { asyncHandler } from "../middleware/error-handler";

const router = Router();

router.get("/overview", asyncHandler(getOverview));
router.get("/entity/:entity", asyncHandler(getEntityAnalytics));

export default router;
