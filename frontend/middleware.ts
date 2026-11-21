import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cloudflare Access guards life-os-dashboard.com before requests reach this
// app, and the backend runs in personal mode. The app's own login page is only
// enforced when REQUIRE_APP_LOGIN=true (e.g. if this is ever multi-user).
const REQUIRE_APP_LOGIN = process.env.REQUIRE_APP_LOGIN === "true";
const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  if (!REQUIRE_APP_LOGIN) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token");

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // If already authenticated and visiting /login, send to dashboard
    if (token && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on all routes except API proxy, Next.js internals and static files
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
