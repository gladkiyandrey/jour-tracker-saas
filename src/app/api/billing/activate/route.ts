import { NextResponse } from "next/server";
import { SUB_EXPIRES_COOKIE, SUB_STATUS_COOKIE } from "@/lib/auth";
import { getCurrentUser } from "@/lib/current-user";
import { activateSubscription } from "@/lib/subscription-store";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const plan = String(form.get("plan") || "monthly");
    const days = plan === "quarterly" ? 90 : 30;
    const user = await getCurrentUser();

    const expiresAt = user
      ? (await activateSubscription(user.id, days, plan)).expiresAt
      : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const res = NextResponse.redirect(new URL("/app", req.url), 303);
    res.cookies.set(SUB_STATUS_COOKIE, "active", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: days * 24 * 60 * 60,
    });
    res.cookies.set(SUB_EXPIRES_COOKIE, expiresAt, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: days * 24 * 60 * 60,
    });

    return res;
  } catch {
    return NextResponse.redirect(new URL("/pricing?error=activate_failed", req.url), 303);
  }
}
