import { getSupabaseAdmin } from "@/lib/supabase/server";

export type UserSettingsRecord = {
  timezone: string;
  startDeposit: number;
};

export const DEFAULT_USER_TIMEZONE = "UTC";
export const DEFAULT_START_DEPOSIT = 10000;

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export async function getUserSettings(userId: string): Promise<UserSettingsRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("user_settings").select("timezone,start_deposit").eq("user_id", userId).maybeSingle();

  if (error) {
    throw new Error(`Failed to load user settings: ${error.message}`);
  }

  const timezone = typeof data?.timezone === "string" && isValidTimeZone(data.timezone) ? data.timezone : DEFAULT_USER_TIMEZONE;
  const startDeposit = Number(data?.start_deposit);
  return {
    timezone,
    startDeposit: Number.isFinite(startDeposit) && startDeposit > 0 ? startDeposit : DEFAULT_START_DEPOSIT,
  };
}

export async function upsertUserSettings(userId: string, settings: Partial<UserSettingsRecord>) {
  const timezone =
    typeof settings.timezone === "string" && isValidTimeZone(settings.timezone) ? settings.timezone : DEFAULT_USER_TIMEZONE;
  const startDeposit =
    Number.isFinite(Number(settings.startDeposit)) && Number(settings.startDeposit) > 0
      ? Number(settings.startDeposit)
      : DEFAULT_START_DEPOSIT;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      timezone,
      start_deposit: startDeposit,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to save user settings: ${error.message}`);
  }

  return { timezone, startDeposit };
}
