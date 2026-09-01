import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Routing convenience ONLY (Next 16 proxy). Redirects signed-out visitors to
 * /login for a smoother UX. This is NOT the authorization boundary — every
 * server action, route handler and page enforces authoritative access control
 * in src/server/permissions.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  // /login is always reachable: the cookie may be stale (e.g. session rows
  // gone) and only the server can tell — the login page itself redirects
  // genuinely authenticated users away after a real session check.
  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (!sessionCookie) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/entry/:path*",
    "/review/:path*",
    "/command-center/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
  ],
};
