import { getSupabaseAdmin } from "@/lib/supabase/server";

export type TrackerVariant = "neg" | "pos" | "pos-outline";
export type TrackerEntry = { result: -1 | 1; variant: TrackerVariant; deposit: number; trades: number };
export type TrackerMap = Record<string, TrackerEntry>;

const RESULT_BY_VARIANT: Record<TrackerVariant, -1 | 1> = {
  neg: -1,
  pos: 1,
  "pos-outline": 1,
};

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function normalizeEntry(entry: Partial<TrackerEntry>): TrackerEntry {
  const variant: TrackerVariant =
    entry.variant === "neg" || entry.variant === "pos" || entry.variant === "pos-outline"
      ? entry.variant
      : Number(entry.result) === -1
        ? "neg"
        : "pos";
  const depositNum = Number(entry.deposit);
  const tradesNum = Number(entry.trades);
  const normalized: TrackerEntry = {
    result: RESULT_BY_VARIANT[variant],
    variant,
    deposit: Number.isFinite(depositNum) && depositNum >= 0 ? depositNum : 0,
    trades: Number.isFinite(tradesNum) && tradesNum >= 0 ? Math.floor(tradesNum) : 0,
  };

  if ((normalized.variant === "neg" || normalized.variant === "pos") && normalized.trades <= 0) {
    throw new Error("trades must be > 0 for neg/pos");
  }

  return normalized;
}

export async function getTrackerData(userId: string): Promise<TrackerMap> {
  const supabase = getSupabaseAdmin();
  const todayKey = getTodayDateKey();

  const { error: cleanupError } = await supabase.from("tracker_entries").delete().eq("user_id", userId).gt("date_key", todayKey);
  if (cleanupError) {
    throw new Error(`Failed to remove future tracker data: ${cleanupError.message}`);
  }

  const { data, error } = await supabase
    .from("tracker_entries")
    .select("date_key,result,variant,deposit,trades_count")
    .eq("user_id", userId)
    .lte("date_key", todayKey);

  if (error) {
    throw new Error(`Failed to load tracker data: ${error.message}`);
  }

  const output: TrackerMap = {};
  for (const row of data ?? []) {
    const rowVariant = row.variant as TrackerVariant;
    const rowTradesRaw = Number(row.trades_count);
    const rowTrades =
      (rowVariant === "neg" || rowVariant === "pos") && (!Number.isFinite(rowTradesRaw) || rowTradesRaw <= 0)
        ? 1
        : rowTradesRaw;

    output[row.date_key as string] = normalizeEntry({
      result: Number(row.result) === -1 ? -1 : 1,
      variant: rowVariant,
      deposit: Number(row.deposit),
      trades: rowTrades,
    });
  }

  return output;
}

export async function upsertTrackerEntry(userId: string, dateKey: string, entry: Partial<TrackerEntry>) {
  const todayKey = getTodayDateKey();
  if (dateKey > todayKey) {
    throw new Error("future dates are not allowed");
  }

  const normalized = normalizeEntry(entry);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("tracker_entries").upsert(
    {
      user_id: userId,
      date_key: dateKey,
      result: normalized.result,
      variant: normalized.variant,
      deposit: normalized.deposit,
      trades_count: normalized.trades,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date_key" },
  );

  if (error) {
    throw new Error(`Failed to save tracker entry: ${error.message}`);
  }

  return normalized;
}

export async function deleteTrackerEntry(userId: string, dateKey: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("tracker_entries").delete().eq("user_id", userId).eq("date_key", dateKey);

  if (error) {
    throw new Error(`Failed to delete tracker entry: ${error.message}`);
  }
}
