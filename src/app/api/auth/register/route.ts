import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth-cookies";
import { syncSubscriptionCookies } from "@/lib/subscription-cookies";
import { getSupabasePublic } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  if (!email || !email.includes("@") || password.length < 6) {
    return NextResponse.redirect(new URL("/login?error=invalid_signup", req.url), 303);
  }

  try {
    const supabase = getSupabasePublic();
    const { data, error } = await supabase.auth.signUp({ email, password });
    const errorText = (error?.message || "").toLowerCase();
    const userId = data.user?.id;
    const userEmail = data.user?.email?.toLowerCase();
    const accessToken = data.session?.access_token;
    const refreshToken = data.session?.refresh_token;
    if (error || !userId || !userEmail) {
      const reason =
        errorText.includes("already registered") || errorText.includes("already been registered")
          ? "email_exists"
          : errorText.includes("signup is disabled")
            ? "signup_disabled"
            : errorText.includes("rate limit")
              ? "rate_limited"
              : errorText.includes("invalid api key")
                ? "bad_supabase_key"
                : "unknown";
      return NextResponse.redirect(new URL(`/login?error=signup_failed&reason=${reason}`, req.url), 303);
    }

    // Email confirmation mode: signup succeeds but no session is issued yet.
    if (!accessToken || !refreshToken) {
      return NextResponse.redirect(
        new URL(`/login?success=check_email&email=${encodeURIComponent(userEmail)}`, req.url),
        303,
      );
    }

    const res = NextResponse.redirect(new URL("/pricing", req.url), 303);
    setAuthCookies(res, { userId, email: userEmail, accessToken, refreshToken });
    await syncSubscriptionCookies(res, userId);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message.toLowerCase() : "";
    const reason = message.includes("supabase") || message.includes("env") ? "bad_env" : "unknown";
    return NextResponse.redirect(new URL(`/login?error=auth_unavailable&reason=${reason}`, req.url), 303);
  }
}
