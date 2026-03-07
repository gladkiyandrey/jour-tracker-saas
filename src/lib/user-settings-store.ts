import { getSupabaseAdmin } from "@/lib/supabase/server";

export type UserSettingsRecord = {
  timezone: string;
};

export const DEFAULT_USER_TIMEZONE = "UTC";

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
  const { data, error } = await supabase.from("user_settings").select("timezone").eq("user_id", userId).maybeSingle();

  if (error) {
    throw new Error(`Failed to load user settings: ${error.message}`);
  }

  const timezone = typeof data?.timezone === "string" && isValidTimeZone(data.timezone) ? data.timezone : DEFAULT_USER_TIMEZONE;
  return { timezone };
}

export async function upsertUserSettings(userId: string, settings: Partial<UserSettingsRecord>) {
  const timezone =
    typeof settings.timezone === "string" && isValidTimeZone(settings.timezone) ? settings.timezone : DEFAULT_USER_TIMEZONE;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      timezone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to save user settings: ${error.message}`);
  }

  return { timezone };
}
