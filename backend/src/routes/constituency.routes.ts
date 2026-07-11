import { Router } from "express";
import { getLucknowConstituency } from "../controllers/constituency.controller";
import { asyncHandler } from "../middleware/error-handler";

const router = Router();

router.get("/lucknow", asyncHandler(getLucknowConstituency));

export default router;
