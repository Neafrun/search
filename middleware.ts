import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieName, isPasswordProtectionEnabled, verifySessionToken } from "@/lib/site-auth";

export async function middleware(request: NextRequest) {
  if (!isPasswordProtectionEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname === "/login" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/api/auth/site-login" ||
    pathname === "/api/auth/site-logout" ||
    pathname === "/api/auth/status"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getCookieName())?.value;
  if (await verifySessionToken(token)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
