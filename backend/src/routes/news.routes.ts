import { Router } from "express";
import { getNews } from "../controllers/news.controller";
import { asyncHandler } from "../middleware/error-handler";

const router = Router();

router.get("/", asyncHandler(getNews));

export default router;
