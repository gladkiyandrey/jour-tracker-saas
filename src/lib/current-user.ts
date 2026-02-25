import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, AUTH_AVATAR_COOKIE, AUTH_COOKIE, AUTH_EMAIL_COOKIE, AUTH_NAME_COOKIE } from "@/lib/auth";
import { getSupabasePublic } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const store = await cookies();
    const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;

    if (!accessToken) return null;

    const supabase = getSupabasePublic();
    const { data, error } = await supabase.auth.getUser(accessToken);
    const userId = data.user?.id;
    const email = data.user?.email?.toLowerCase();

    if (error || !userId || !email) return null;

    const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
    const fromMeta =
      (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
      (typeof meta?.name === "string" && meta.name.trim()) ||
      (typeof meta?.preferred_username === "string" && meta.preferred_username.trim()) ||
      undefined;
    const avatarUrl =
      (typeof meta?.avatar_url === "string" && meta.avatar_url.trim()) ||
      (typeof meta?.picture === "string" && meta.picture.trim()) ||
      undefined;

    return { id: userId, email, displayName: fromMeta, avatarUrl };
  } catch {
    return null;
  }
}

export async function getCurrentUserFromSessionCookies(): Promise<CurrentUser | null> {
  try {
    const store = await cookies();
    const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
    const userId = store.get(AUTH_COOKIE)?.value;
    const email = store.get(AUTH_EMAIL_COOKIE)?.value?.toLowerCase();
    const displayName = store.get(AUTH_NAME_COOKIE)?.value?.trim();
    const avatarUrl = store.get(AUTH_AVATAR_COOKIE)?.value?.trim();

    if (!accessToken || !userId || !email) {
      return null;
    }

    return {
      id: userId,
      email,
      displayName: displayName || undefined,
      avatarUrl: avatarUrl || undefined,
    };
  } catch {
    return null;
  }
}
