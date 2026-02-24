import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth-cookies";
import { syncSubscriptionCookies } from "@/lib/subscription-cookies";
import { getSupabasePublic } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { accessToken?: string; refreshToken?: string } | null;
  const accessToken = body?.accessToken;
  const refreshToken = body?.refreshToken;

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 400 });
  }

  const supabase = getSupabasePublic();
  const { data, error } = await supabase.auth.getUser(accessToken);
  const userId = data.user?.id;
  const email = data.user?.email?.toLowerCase();

  if (error || !userId || !email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, { userId, email, accessToken, refreshToken });
  const sub = await syncSubscriptionCookies(res, userId, email);
  res.headers.set("x-sub-active", sub.active ? "1" : "0");
  return res;
}
