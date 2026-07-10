import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_PAGES = new Set(["/login", "/signup"]);
const PUBLIC_API_PREFIXES = ["/api/auth/login", "/api/auth/signup"];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = token ? verifySessionToken(token) : null;

  if (PUBLIC_PAGES.has(pathname) || isPublicApi(pathname)) {
    if (userId && PUBLIC_PAGES.has(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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
