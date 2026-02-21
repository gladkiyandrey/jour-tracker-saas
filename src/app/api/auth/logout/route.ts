import { NextResponse } from "next/server";
import { SUB_EXPIRES_COOKIE, SUB_STATUS_COOKIE } from "@/lib/auth";
import { clearAuthCookies } from "@/lib/auth-cookies";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  clearAuthCookies(res);
  res.cookies.delete(SUB_STATUS_COOKIE);
  res.cookies.delete(SUB_EXPIRES_COOKIE);
  return res;
}
