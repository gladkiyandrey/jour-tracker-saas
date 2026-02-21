import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSupabasePublic } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { accessToken?: string } | null;
  const accessToken = body?.accessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 400 });
  }

  const supabase = getSupabasePublic();
  const { data, error } = await supabase.auth.getUser(accessToken);
  const email = data.user?.email?.toLowerCase();

  if (error || !email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

