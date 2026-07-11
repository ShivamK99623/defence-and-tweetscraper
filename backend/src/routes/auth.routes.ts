import { Router } from "express";
import {
  createUserHandler,
  getCurrentUser,
  login,
  logout,
  signup,
} from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/error-handler";

const router = Router();

router.post("/login", asyncHandler(login));
router.delete("/login", asyncHandler(logout));
router.post("/signup", asyncHandler(signup));
router.get("/users", asyncHandler(getCurrentUser));
router.post("/users", asyncHandler(createUserHandler));

export default router;
