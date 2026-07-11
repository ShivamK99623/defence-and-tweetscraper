import type { Request, Response } from "express";
import {
  authenticateUser,
  createUser,
  findUserById,
} from "@/services/auth/users";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import { serializeApiTimestamps } from "@/lib/db/timestamps";
import { AppError } from "../middleware/error-handler";

export async function login(req: Request, res: Response): Promise<void> {
  const email = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!email || !password) {
    throw new AppError(400, "Email and password are required");
  }

  const user = await authenticateUser(email, password);
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = createSessionToken(user.id);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  res.json(
    serializeApiTimestamps({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    })
  );
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.json({ success: true });
}

export async function signup(req: Request, res: Response): Promise<void> {
  const email = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");
  const name =
    typeof req.body?.name === "string" ? req.body.name.trim() : undefined;

  if (!email || !password) {
    throw new AppError(400, "Email and password are required");
  }

  try {
    const user = await createUser({ email, password, name });
    const token = createSessionToken(user.id);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    res.json(
      serializeApiTimestamps({
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
      })
    );
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      throw new AppError(409, "Email already registered");
    }
    throw error;
  }
}

export async function getCurrentUser(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError(401, "Unauthorized");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(401, "Unauthorized");
  }

  res.json(
    serializeApiTimestamps({
      success: true,
      user,
    })
  );
}

export async function createUserHandler(
  req: Request,
  res: Response
): Promise<void> {
  const email = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");
  const name =
    typeof req.body?.name === "string" ? req.body.name.trim() : undefined;

  if (!email || !password) {
    throw new AppError(400, "Email and password are required");
  }

  try {
    const user = await createUser({ email, password, name });
    res.status(201).json(
      serializeApiTimestamps({
        success: true,
        user,
      })
    );
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      throw new AppError(409, "Email already registered");
    }
    throw error;
  }
}
