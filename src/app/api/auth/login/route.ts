import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth-cookies";
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
    if (error || !userId || !userEmail || !accessToken || !refreshToken) {
      return NextResponse.redirect(new URL("/login?error=invalid_credentials", req.url), 303);
    }

    const res = NextResponse.redirect(new URL("/pricing", req.url), 303);
    setAuthCookies(res, { userId, email: userEmail, accessToken, refreshToken });
    return res;
  } catch {
    return NextResponse.redirect(new URL("/login?error=auth_unavailable", req.url), 303);
  }
}
