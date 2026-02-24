import { getSupabaseAdmin } from "@/lib/supabase/server";

async function loadUserEmailMap() {
  const supabase = getSupabaseAdmin();
  const usersById = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }
    for (const user of data.users) {
      if (user.email) {
        usersById.set(user.id, user.email.toLowerCase());
      }
    }
    if (data.users.length < 1000) break;
    page += 1;
  }
  return usersById;
}

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

  const usersById = await loadUserEmailMap();

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

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

export async function resolveUserByTarget(targetRaw: string) {
  const supabase = getSupabaseAdmin();
  const target = targetRaw.trim().toLowerCase();
  if (!target) {
    throw new Error("Target is required");
  }

  if (isUuid(target)) {
    const { data, error } = await supabase.auth.admin.getUserById(target);
    if (error || !data?.user) {
      throw new Error("User not found by user_id");
    }
    return {
      userId: data.user.id,
      email: data.user.email?.toLowerCase() ?? "unknown",
    };
  }

  const usersById = await loadUserEmailMap();
  for (const [id, email] of usersById.entries()) {
    if (email === target) {
      return { userId: id, email };
    }
  }
  throw new Error("User not found by email");
}

export async function grantTrialSubscription(args: {
  targetUserId: string;
  grantedByUserId: string;
  days: 1 | 7 | 30;
  reason: string;
}) {
  const { targetUserId, grantedByUserId, days, reason } = args;
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const { data: current, error: currentErr } = await supabase
    .from("user_subscriptions")
    .select("expires_at,status")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (currentErr) {
    throw new Error(`Failed to read current subscription: ${currentErr.message}`);
  }

  const currentExpiryMs = current?.expires_at && !Number.isNaN(Date.parse(current.expires_at)) ? Date.parse(current.expires_at) : 0;
  const baseMs = Math.max(now, currentExpiryMs);
  const newExpiresAt = new Date(baseMs + days * 24 * 60 * 60 * 1000).toISOString();

  const { error: upsertErr } = await supabase.from("user_subscriptions").upsert(
    {
      user_id: targetUserId,
      status: "active",
      plan_code: `trial_${days}d`,
      provider: "admin_grant",
      expires_at: newExpiresAt,
      last_payment_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );
  if (upsertErr) {
    throw new Error(`Failed to grant subscription: ${upsertErr.message}`);
  }

  // Audit log is best-effort: grant should still succeed even if audit table is missing.
  const { error: auditErr } = await supabase.from("subscription_grants").insert({
    target_user_id: targetUserId,
    granted_by_user_id: grantedByUserId,
    days,
    reason,
    expires_at_after: newExpiresAt,
    created_at: nowIso,
  });
  if (auditErr && !auditErr.message.toLowerCase().includes("relation") && !auditErr.message.toLowerCase().includes("does not exist")) {
    throw new Error(`Granted but failed to save audit log: ${auditErr.message}`);
  }

  return { expiresAt: newExpiresAt };
}

export type SubscriptionGrantAdminRow = {
  id: string;
  targetUserId: string;
  targetEmail: string;
  grantedByUserId: string;
  grantedByEmail: string;
  days: number;
  reason: string | null;
  expiresAtAfter: string | null;
  createdAt: string;
};

export async function listSubscriptionGrantsForAdmin(limit = 100): Promise<SubscriptionGrantAdminRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subscription_grants")
    .select("id,target_user_id,granted_by_user_id,days,reason,expires_at_after,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.message.toLowerCase().includes("relation") || error.message.toLowerCase().includes("does not exist")) {
      return [];
    }
    throw new Error(`Failed to list subscription grants: ${error.message}`);
  }

  const usersById = await loadUserEmailMap();
  return (data ?? []).map((row) => ({
    id: row.id,
    targetUserId: row.target_user_id,
    targetEmail: usersById.get(row.target_user_id) ?? "unknown",
    grantedByUserId: row.granted_by_user_id,
    grantedByEmail: usersById.get(row.granted_by_user_id) ?? "unknown",
    days: row.days,
    reason: row.reason ?? null,
    expiresAtAfter: row.expires_at_after ?? null,
    createdAt: row.created_at,
  }));
}
