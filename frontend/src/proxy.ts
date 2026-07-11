import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

const PUBLIC_PAGES = new Set(["/login", "/signup"]);

function isAuthDisabled(): boolean {
  const value =
    process.env.AUTH_DISABLED?.trim().toLowerCase() ??
    process.env.NEXT_PUBLIC_AUTH_DISABLED?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

/**
 * Page-level auth gate only. API traffic goes directly to the Express backend
 * (NEXT_PUBLIC_API_URL) and is not proxied through Next.js.
 */
export async function proxy(request: NextRequest) {
  if (isAuthDisabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = token ? verifySessionToken(token) : null;

  if (PUBLIC_PAGES.has(pathname)) {
    if (userId) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!userId) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
