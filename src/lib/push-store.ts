import { getSupabaseAdmin } from "@/lib/supabase/server";

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
};

export async function upsertPushSubscription(userId: string, payload: PushSubscriptionRecord) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: payload.endpoint,
      p256dh: payload.p256dh,
      auth: payload.auth,
      user_agent: payload.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    throw new Error(`Failed to save push subscription: ${error.message}`);
  }
}

export async function removePushSubscription(userId: string, endpoint: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    throw new Error(`Failed to remove push subscription: ${error.message}`);
  }
}

export async function getPushSubscriptionsByUser(userId: string): Promise<PushSubscriptionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,user_agent")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to load push subscriptions: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
    userAgent: row.user_agent ? String(row.user_agent) : null,
  }));
}

export async function getAllPushSubscriptions(): Promise<Array<PushSubscriptionRecord & { userId: string }>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("push_subscriptions").select("endpoint,p256dh,auth,user_agent,user_id");
  if (error) {
    throw new Error(`Failed to load push subscriptions: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
    userAgent: row.user_agent ? String(row.user_agent) : null,
    userId: String(row.user_id),
  }));
}
