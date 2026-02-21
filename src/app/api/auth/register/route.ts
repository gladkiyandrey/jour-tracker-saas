import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
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
    if (error || !data.user?.email) {
      return NextResponse.redirect(new URL("/login?error=signup_failed", req.url), 303);
    }
  } catch {
    return NextResponse.redirect(new URL("/login?error=auth_unavailable", req.url), 303);
  }

  const res = NextResponse.redirect(new URL("/pricing", req.url), 303);
  res.cookies.set(AUTH_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

