import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, AUTH_AVATAR_COOKIE, AUTH_COOKIE, AUTH_EMAIL_COOKIE, AUTH_NAME_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth";

export function setAuthCookies(
  res: NextResponse,
  params: {
    userId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    displayName?: string;
    avatarUrl?: string;
    maxAge?: number;
  },
) {
  const maxAge = params.maxAge ?? 60 * 60 * 24 * 30;
  const options = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };

  res.cookies.set(AUTH_COOKIE, params.userId, options);
  res.cookies.set(AUTH_EMAIL_COOKIE, params.email, options);
  res.cookies.set(ACCESS_TOKEN_COOKIE, params.accessToken, options);
  res.cookies.set(REFRESH_TOKEN_COOKIE, params.refreshToken, options);
  if (params.displayName && params.displayName.trim()) {
    res.cookies.set(AUTH_NAME_COOKIE, params.displayName.trim(), options);
  } else {
    res.cookies.delete(AUTH_NAME_COOKIE);
  }
  if (params.avatarUrl && params.avatarUrl.trim()) {
    res.cookies.set(AUTH_AVATAR_COOKIE, params.avatarUrl.trim(), options);
  } else {
    res.cookies.delete(AUTH_AVATAR_COOKIE);
  }
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.delete(AUTH_COOKIE);
  res.cookies.delete(AUTH_EMAIL_COOKIE);
  res.cookies.delete(ACCESS_TOKEN_COOKIE);
  res.cookies.delete(REFRESH_TOKEN_COOKIE);
  res.cookies.delete(AUTH_NAME_COOKIE);
  res.cookies.delete(AUTH_AVATAR_COOKIE);
}
