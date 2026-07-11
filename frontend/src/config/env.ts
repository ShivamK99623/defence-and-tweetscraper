/**
 * Strongly typed frontend environment configuration.
 * All API base URLs must come from here — never hardcode hosts elsewhere.
 *
 * IMPORTANT: Next.js only inlines `process.env.NEXT_PUBLIC_*` when accessed
 * with a static property name (not `process.env[name]`).
 */

const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!rawApiBaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not defined. Set it in .env.local (e.g. NEXT_PUBLIC_API_URL=http://localhost:4000)."
  );
}

/** Backend origin only (no trailing slash), e.g. http://localhost:4000 */
export const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, "");

/**
 * When true, skip client-side login redirects on 401.
 * Must use NEXT_PUBLIC_* so the browser bundle can read it.
 * Pair with AUTH_DISABLED on the backend and AUTH_DISABLED / NEXT_PUBLIC_AUTH_DISABLED
 * for the Next.js page proxy.
 */
const authDisabledRaw = process.env.NEXT_PUBLIC_AUTH_DISABLED?.trim().toLowerCase();
export const AUTH_DISABLED =
  authDisabledRaw === "1" ||
  authDisabledRaw === "true" ||
  authDisabledRaw === "yes" ||
  authDisabledRaw === "on";
