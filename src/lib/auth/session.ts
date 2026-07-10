import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-auth-secret-change-in-production";
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(userId: number): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userIdRaw, expiresAtRaw, signature] = parts;
  const payload = `${userIdRaw}.${expiresAtRaw}`;
  const expected = signPayload(payload);

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const userId = Number(userIdRaw);
  if (!Number.isInteger(userId) || userId <= 0) return null;

  return userId;
}

export async function getSessionUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
