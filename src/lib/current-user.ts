import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";
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
