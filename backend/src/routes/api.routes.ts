import { Router } from "express";
import { exportData } from "../controllers/export.controller";
import {
  exportPdfGet,
  exportPdfPost,
} from "../controllers/export-pdf.controller";
import { uploadFile } from "../controllers/upload.controller";
import { asyncHandler } from "../middleware/error-handler";

const router = Router();

router.get("/export", asyncHandler(exportData));
router.get("/export/pdf", asyncHandler(exportPdfGet));
router.post("/export/pdf", asyncHandler(exportPdfPost));
router.post("/upload", asyncHandler(uploadFile));

export default router;
