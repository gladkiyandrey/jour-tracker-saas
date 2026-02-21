import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type ShareVariant = "neg" | "pos" | "pos-outline";
export type ShareDay = { day: number; variant: ShareVariant };
export type SharePayload = {
  year: number;
  month: number;
  score: number;
  greenStreak: number;
  redStreak: number;
  chartYellow: string;
  chartBlue: string;
  days: ShareDay[];
};

export type ShareSnapshot = SharePayload & {
  id: string;
  userId: string;
  createdAt: string;
};

function randomId() {
  return randomBytes(5).toString("base64url");
}

function sanitizePayload(input: SharePayload): SharePayload {
  const year = Number(input.year);
  const month = Number(input.month);
  const score = Math.max(0, Math.min(100, Number(input.score) || 0));
  const greenStreak = Math.max(0, Number(input.greenStreak) || 0);
  const redStreak = Math.max(0, Number(input.redStreak) || 0);
  const chartYellow = typeof input.chartYellow === "string" ? input.chartYellow.slice(0, 8000) : "";
  const chartBlue = typeof input.chartBlue === "string" ? input.chartBlue.slice(0, 8000) : "";
  const days = Array.isArray(input.days)
    ? input.days
        .map((d) => ({
          day: Number(d.day),
          variant: d.variant,
        }))
        .filter(
          (d): d is ShareDay =>
            Number.isInteger(d.day) &&
            d.day >= 1 &&
            d.day <= 31 &&
            (d.variant === "neg" || d.variant === "pos" || d.variant === "pos-outline")
        )
        .slice(0, 31)
    : [];

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Invalid year");
  }
  if (!Number.isInteger(month) || month < 0 || month > 11) {
    throw new Error("Invalid month");
  }

  return {
    year,
    month,
    score,
    greenStreak,
    redStreak,
    chartYellow,
    chartBlue,
    days,
  };
}

export async function createShareSnapshot(userId: string, rawPayload: SharePayload) {
  const payload = sanitizePayload(rawPayload);
  const supabase = getSupabaseAdmin();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = randomId();
    const { error } = await supabase.from("share_snapshots").insert({
      id,
      user_id: userId,
      year: payload.year,
      month: payload.month,
      score: payload.score,
      green_streak: payload.greenStreak,
      red_streak: payload.redStreak,
      chart_yellow: payload.chartYellow,
      chart_blue: payload.chartBlue,
      days: payload.days,
    });
    if (!error) return { id };
    if (!error.message.toLowerCase().includes("duplicate")) {
      throw new Error(`Failed to create share snapshot: ${error.message}`);
    }
  }

  throw new Error("Failed to allocate short share id");
}

export async function getShareSnapshot(id: string): Promise<ShareSnapshot | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("share_snapshots")
    .select("id,user_id,year,month,score,green_streak,red_streak,chart_yellow,chart_blue,days,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load share snapshot: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    year: data.year,
    month: data.month,
    score: data.score,
    greenStreak: data.green_streak,
    redStreak: data.red_streak,
    chartYellow: data.chart_yellow ?? "",
    chartBlue: data.chart_blue ?? "",
    days: Array.isArray(data.days) ? (data.days as ShareDay[]) : [],
    createdAt: data.created_at,
  };
}
