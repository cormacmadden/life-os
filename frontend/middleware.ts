import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) {
    // If already authenticated and visiting /login, send to dashboard
    const token = request.cookies.get("access_token");
    if (token && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Require auth cookie for all other pages
  const token = request.cookies.get("access_token");
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
