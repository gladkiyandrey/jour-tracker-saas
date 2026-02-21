import { getSupabaseAdmin } from "@/lib/supabase/server";

export type TrackerVariant = "neg" | "pos" | "pos-outline";
export type TrackerEntry = { result: -1 | 1; variant: TrackerVariant; deposit: number };
export type TrackerMap = Record<string, TrackerEntry>;

const RESULT_BY_VARIANT: Record<TrackerVariant, -1 | 1> = {
  neg: -1,
  pos: 1,
  "pos-outline": 1,
};

function normalizeEntry(entry: Partial<TrackerEntry>): TrackerEntry {
  const variant: TrackerVariant =
    entry.variant === "neg" || entry.variant === "pos" || entry.variant === "pos-outline"
      ? entry.variant
      : Number(entry.result) === -1
        ? "neg"
        : "pos";
  const depositNum = Number(entry.deposit);
  return {
    result: RESULT_BY_VARIANT[variant],
    variant,
    deposit: Number.isFinite(depositNum) && depositNum >= 0 ? depositNum : 0,
  };
}

export async function getTrackerData(userId: string): Promise<TrackerMap> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tracker_entries")
    .select("date_key,result,variant,deposit")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to load tracker data: ${error.message}`);
  }

  const output: TrackerMap = {};
  for (const row of data ?? []) {
    output[row.date_key as string] = normalizeEntry({
      result: Number(row.result) === -1 ? -1 : 1,
      variant: row.variant as TrackerVariant,
      deposit: Number(row.deposit),
    });
  }

  return output;
}

export async function upsertTrackerEntry(userId: string, dateKey: string, entry: Partial<TrackerEntry>) {
  const normalized = normalizeEntry(entry);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("tracker_entries").upsert(
    {
      user_id: userId,
      date_key: dateKey,
      result: normalized.result,
      variant: normalized.variant,
      deposit: normalized.deposit,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date_key" },
  );

  if (error) {
    throw new Error(`Failed to save tracker entry: ${error.message}`);
  }

  return normalized;
}
