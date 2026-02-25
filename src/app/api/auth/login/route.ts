import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth-cookies";
import { syncSubscriptionCookies } from "@/lib/subscription-cookies";
import { getSupabasePublic } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  if (!email || !email.includes("@") || !password) {
    return NextResponse.redirect(new URL("/login?error=invalid_credentials", req.url), 303);
  }

  try {
    const supabase = getSupabasePublic();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    const userId = data.user?.id;
    const userEmail = data.user?.email?.toLowerCase();
    const accessToken = data.session?.access_token;
    const refreshToken = data.session?.refresh_token;
    const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
    const displayName =
      (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
      (typeof meta?.name === "string" && meta.name.trim()) ||
      (typeof meta?.preferred_username === "string" && meta.preferred_username.trim()) ||
      undefined;
    const avatarUrl =
      (typeof meta?.avatar_url === "string" && meta.avatar_url.trim()) ||
      (typeof meta?.picture === "string" && meta.picture.trim()) ||
      undefined;
    if (error || !userId || !userEmail || !accessToken || !refreshToken) {
      return NextResponse.redirect(new URL("/login?error=invalid_credentials", req.url), 303);
    }

    const res = NextResponse.redirect(new URL("/pricing", req.url), 303);
    setAuthCookies(res, { userId, email: userEmail, accessToken, refreshToken, displayName, avatarUrl });
    const sub = await syncSubscriptionCookies(res, userId, userEmail);
    if (!sub.active) return res;

    const activeRes = NextResponse.redirect(new URL("/app", req.url), 303);
    setAuthCookies(activeRes, { userId, email: userEmail, accessToken, refreshToken, displayName, avatarUrl });
    await syncSubscriptionCookies(activeRes, userId, userEmail);
    return activeRes;
  } catch {
    return NextResponse.redirect(new URL("/login?error=auth_unavailable", req.url), 303);
  }
}
