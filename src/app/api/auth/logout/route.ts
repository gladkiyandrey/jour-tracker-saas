import { NextResponse } from "next/server";
import { AUTH_COOKIE, SUB_EXPIRES_COOKIE, SUB_STATUS_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete(AUTH_COOKIE);
  res.cookies.delete(SUB_STATUS_COOKIE);
  res.cookies.delete(SUB_EXPIRES_COOKIE);
  return res;
}
