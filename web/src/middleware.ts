import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPages = ["/history", "/view"];
const protectedAPIs = ["/api/files", "/api/file"];
const publicOnlyPages = ["/", "/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  // Redirect signed-in users away from public-only pages to /history
  if (publicOnlyPages.includes(pathname) && sessionCookie) {
    return NextResponse.redirect(new URL("/history", request.url));
  }

  const isProtectedPage = protectedPages.some((r) => pathname.startsWith(r));
  const isProtectedAPI = protectedAPIs.some((r) => pathname.startsWith(r));

  if (!isProtectedPage && !isProtectedAPI) {
    return NextResponse.next();
  }

  if (!sessionCookie) {
    if (isProtectedAPI) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/history/:path*", "/view/:path*", "/api/files/:path*", "/api/file/:path*"],
};
