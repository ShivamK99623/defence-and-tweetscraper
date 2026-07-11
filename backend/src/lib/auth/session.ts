import { createHmac, timingSafeEqual } from "crypto";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-auth-secret-change-in-production";
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(userId: string): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token: string): string | null {
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

  if (!userIdRaw || userIdRaw.length === 0) return null;

  return userIdRaw;
}

export function sessionCookieOptions() {
  /**
   * Cross-site SPA → API (different registrable domains) needs SameSite=None; Secure.
   * Same-site setups (localhost:3000 ↔ localhost:4000, or shared parent domain) can use Lax.
   * Set COOKIE_SAME_SITE=none in staging/production when the frontend origin ≠ API origin.
   */
  const sameSite =
    process.env.COOKIE_SAME_SITE === "none" ? ("none" as const) : ("lax" as const);
  const secure =
    sameSite === "none" || process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
