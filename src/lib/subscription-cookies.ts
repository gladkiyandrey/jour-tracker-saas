import { NextResponse } from "next/server";
import { SUB_EXPIRES_COOKIE, SUB_STATUS_COOKIE } from "@/lib/auth";
import { applyPendingSubscriptionGrantForUser, getSubscriptionStateFromDb } from "@/lib/subscription-store";

export async function syncSubscriptionCookies(res: NextResponse, userId: string, email?: string | null) {
  try {
    await applyPendingSubscriptionGrantForUser({ userId, email });
    const sub = await getSubscriptionStateFromDb(userId);
    if (sub.active && sub.expiresAt) {
      const maxAge = Math.max(1, Math.floor((Date.parse(sub.expiresAt) - Date.now()) / 1000));
      res.cookies.set(SUB_STATUS_COOKIE, "active", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge,
      });
      res.cookies.set(SUB_EXPIRES_COOKIE, sub.expiresAt, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge,
      });
      return { active: true as const };
    }
  } catch {
    // ignore, fallback to inactive
  }

  res.cookies.delete(SUB_STATUS_COOKIE);
  res.cookies.delete(SUB_EXPIRES_COOKIE);
  return { active: false as const };
}
