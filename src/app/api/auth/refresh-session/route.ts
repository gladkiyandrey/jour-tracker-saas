import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth-cookies";
import { REFRESH_TOKEN_COOKIE } from "@/lib/auth";
import { syncSubscriptionCookies } from "@/lib/subscription-cookies";
import { getSupabasePublic } from "@/lib/supabase/server";

export async function POST() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    const res = NextResponse.json({ error: "Missing refresh token" }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }

  try {
    const supabase = getSupabasePublic();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    const session = data.session;
    const user = data.user;
    const accessToken = session?.access_token;
    const nextRefreshToken = session?.refresh_token;
    const userId = user?.id;
    const email = user?.email?.toLowerCase();
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const displayName =
      (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
      (typeof meta?.name === "string" && meta.name.trim()) ||
      (typeof meta?.preferred_username === "string" && meta.preferred_username.trim()) ||
      undefined;
    const avatarUrl =
      (typeof meta?.avatar_url === "string" && meta.avatar_url.trim()) ||
      (typeof meta?.picture === "string" && meta.picture.trim()) ||
      undefined;

    if (error || !userId || !email || !accessToken || !nextRefreshToken) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    const res = NextResponse.json({ ok: true });
    setAuthCookies(res, {
      userId,
      email,
      accessToken,
      refreshToken: nextRefreshToken,
      displayName,
      avatarUrl,
    });
    await syncSubscriptionCookies(res, userId, email);
    return res;
  } catch {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
}
