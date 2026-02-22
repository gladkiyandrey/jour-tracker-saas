import { getSupabaseAdmin } from "@/lib/supabase/server";

export type AdminUserCard = {
  userId: string;
  email: string | null;
  userCreatedAt: string | null;
  lastSignInAt: string | null;
  subscription: {
    status: string;
    planCode: string | null;
    provider: string | null;
    createdAt: string | null;
    lastPaymentAt: string | null;
    expiresAt: string | null;
  } | null;
  trackerEntriesCount: number;
  trackerEntries30d: number;
  shareCount: number;
};

export async function getAdminUserCard(userId: string): Promise<AdminUserCard | null> {
  const supabase = getSupabaseAdmin();

  const [userRes, subRes, trackerCountRes, tracker30dRes, shareCountRes] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from("user_subscriptions")
      .select("status,plan_code,provider,created_at,last_payment_at,expires_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("tracker_entries").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("tracker_entries")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("date_key", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    supabase.from("share_snapshots").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  if (userRes.error) {
    if (userRes.error.message.toLowerCase().includes("not found")) return null;
    throw new Error(`Failed to load user: ${userRes.error.message}`);
  }
  if (subRes.error) throw new Error(`Failed to load subscription: ${subRes.error.message}`);
  if (trackerCountRes.error) throw new Error(`Failed to count tracker entries: ${trackerCountRes.error.message}`);
  if (tracker30dRes.error) throw new Error(`Failed to count tracker entries (30d): ${tracker30dRes.error.message}`);
  if (shareCountRes.error) throw new Error(`Failed to count shares: ${shareCountRes.error.message}`);

  const sub = subRes.data;
  const user = userRes.data.user;

  return {
    userId,
    email: user.email ?? null,
    userCreatedAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    subscription: sub
      ? {
          status: sub.status,
          planCode: sub.plan_code ?? null,
          provider: sub.provider ?? null,
          createdAt: sub.created_at ?? null,
          lastPaymentAt: sub.last_payment_at ?? null,
          expiresAt: sub.expires_at ?? null,
        }
      : null,
    trackerEntriesCount: trackerCountRes.count ?? 0,
    trackerEntries30d: tracker30dRes.count ?? 0,
    shareCount: shareCountRes.count ?? 0,
  };
}

