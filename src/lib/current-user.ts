import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";
import { getSupabasePublic } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) return null;

  const supabase = getSupabasePublic();
  const { data, error } = await supabase.auth.getUser(accessToken);
  const userId = data.user?.id;
  const email = data.user?.email?.toLowerCase();

  if (error || !userId || !email) return null;

  return { id: userId, email };
}
