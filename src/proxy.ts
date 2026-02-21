import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, SUB_EXPIRES_COOKIE, SUB_STATUS_COOKIE } from "@/lib/auth";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  const session = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const status = req.cookies.get(SUB_STATUS_COOKIE)?.value;
  const expiresAt = req.cookies.get(SUB_EXPIRES_COOKIE)?.value;
  const active =
    status === "active" &&
    !!expiresAt &&
    !Number.isNaN(Date.parse(expiresAt)) &&
    Date.parse(expiresAt) > Date.now();

  if (!active) {
    return NextResponse.redirect(new URL("/pricing?expired=1", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
