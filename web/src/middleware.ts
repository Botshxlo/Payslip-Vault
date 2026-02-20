import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPages = ["/history", "/view"];
const protectedAPIs = ["/api/files", "/api/file"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedPage = protectedPages.some((r) => pathname.startsWith(r));
  const isProtectedAPI = protectedAPIs.some((r) => pathname.startsWith(r));

  if (!isProtectedPage && !isProtectedAPI) {
    return NextResponse.next();
  }

  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

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
  matcher: ["/history/:path*", "/view/:path*", "/api/files/:path*", "/api/file/:path*"],
};
