import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Exact-match public routes
const PUBLIC_EXACT = ["/"];
// Prefix-match public routes
const PUBLIC_PREFIXES = ["/login", "/register", "/api/"];

export function middleware(request: NextRequest) {
  // Demo mode: bypass all auth checks and set a presence cookie so the
  // app-layout can detect "authenticated" state without a real Firebase session.
  if (process.env["DEMO_MODE"] === "true") {
    const response = NextResponse.next();
    if (!request.cookies.has("firebase-session")) {
      response.cookies.set("firebase-session", "demo", {
        path: "/",
        maxAge: 86400,
        sameSite: "lax",
      });
    }
    return response;
  }

  const { pathname } = request.nextUrl;

  // Always allow public paths and Next.js internals
  if (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("firebase-session");

  // Unauthenticated: redirect to login for any protected route
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated users trying to access login/register: send to dashboard
  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static assets and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
