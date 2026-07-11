import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { AppError } from "../middleware/error-handler";

const PUBLIC_API_PREFIXES = ["/api/auth/login", "/api/auth/signup"];

function isAuthDisabled(): boolean {
  const value = process.env.AUTH_DISABLED?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (isAuthDisabled() || isPublicApi(req.path)) {
    next();
    return;
  }

  const token = req.cookies?.[SESSION_COOKIE];
  const userId = token ? verifySessionToken(token) : null;

  if (!userId) {
    next(new AppError(401, "Unauthorized", "Unauthorized"));
    return;
  }

  req.userId = userId;
  next();
}
