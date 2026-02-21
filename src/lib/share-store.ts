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

export type ShareAdminRow = {
  id: string;
  userId: string;
  email: string;
  score: number;
  month: number;
  year: number;
  createdAt: string;
  publicUrlPath: string;
  approxBytes: number;
};

export async function listSharesForAdmin(limit = 200): Promise<ShareAdminRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("share_snapshots")
    .select("id,user_id,score,month,year,created_at,chart_yellow,chart_blue,days")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list shares: ${error.message}`);
  }

  const usersById = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (usersError) {
      throw new Error(`Failed to list users: ${usersError.message}`);
    }
    for (const user of usersData.users) {
      if (user.email) usersById.set(user.id, user.email.toLowerCase());
    }
    if (usersData.users.length < 1000) break;
    page += 1;
  }

  return (data ?? []).map((row) => {
    const chartYellow = row.chart_yellow ?? "";
    const chartBlue = row.chart_blue ?? "";
    const daysJson = JSON.stringify(row.days ?? []);
    const approxBytes = new TextEncoder().encode(`${chartYellow}${chartBlue}${daysJson}`).length;
    return {
      id: row.id,
      userId: row.user_id,
      email: usersById.get(row.user_id) ?? "unknown",
      score: row.score,
      month: row.month,
      year: row.year,
      createdAt: row.created_at,
      publicUrlPath: `/s/${row.id}`,
      approxBytes,
    };
  });
}
