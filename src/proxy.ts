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

  if (pathname === "/login") {
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
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
