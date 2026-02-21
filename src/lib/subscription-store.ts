import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function getSubscriptionStateFromDb(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("status,expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load subscription: ${error.message}`);
  }

  const status = data?.status ?? "inactive";
  const expiresAt = data?.expires_at ?? null;
  const active =
    status === "active" && !!expiresAt && !Number.isNaN(Date.parse(expiresAt)) && Date.parse(expiresAt) > Date.now();

  return { active, status, expiresAt };
}

export async function activateSubscription(userId: string, days: number, planCode: string) {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("user_subscriptions").upsert(
    {
      user_id: userId,
      status: "active",
      plan_code: planCode,
      expires_at: expiresAt,
      last_payment_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    throw new Error(`Failed to activate subscription: ${error.message}`);
  }
  return { expiresAt };
}

export type SubscriptionAdminRow = {
  userId: string;
  email: string;
  status: string;
  planCode: string | null;
  provider: string | null;
  startedAt: string | null;
  lastPaymentAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
};

export async function listSubscriptionsForAdmin(limit = 200): Promise<SubscriptionAdminRow[]> {
  const supabase = getSupabaseAdmin();
  const { data: subRows, error } = await supabase
    .from("user_subscriptions")
    .select("user_id,status,plan_code,provider,created_at,last_payment_at,expires_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list subscriptions: ${error.message}`);
  }

  const usersById = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (usersError) {
      throw new Error(`Failed to list users: ${usersError.message}`);
    }
    for (const user of data.users) {
      if (user.email) {
        usersById.set(user.id, user.email.toLowerCase());
      }
    }
    if (data.users.length < 1000) break;
    page += 1;
  }

  return (subRows ?? []).map((row) => {
    const expiresAt = row.expires_at ?? null;
    const isExpired = !!expiresAt && !Number.isNaN(Date.parse(expiresAt)) && Date.parse(expiresAt) <= Date.now();
    return {
      userId: row.user_id,
      email: usersById.get(row.user_id) ?? "unknown",
      status: row.status,
      planCode: row.plan_code ?? null,
      provider: row.provider ?? null,
      startedAt: row.created_at ?? null,
      lastPaymentAt: row.last_payment_at ?? row.updated_at ?? null,
      expiresAt,
      isExpired,
    };
  });
}
