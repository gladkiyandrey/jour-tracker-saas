import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function getSubscriptionStateFromDb(email: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("status,expires_at")
    .eq("user_email", email)
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

export async function activateSubscription(email: string, days: number) {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("user_subscriptions").upsert(
    {
      user_email: email,
      status: "active",
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_email" },
  );
  if (error) {
    throw new Error(`Failed to activate subscription: ${error.message}`);
  }
  return { expiresAt };
}

