import { getSupabaseAdmin } from "@/lib/supabase/server";

export type JournalChart = {
  id: string;
  name: string;
  dataUrl: string;
};

export type JournalEntry = {
  dateKey: string;
  marketBias: string;
  setupFocus: string;
  invalidation: string;
  riskPlan: string;
  premarketNotes: string;
  postmarketNotes: string;
  charts: JournalChart[];
  updatedAt: string;
};

export type JournalInput = Omit<JournalEntry, "updatedAt">;

function normalizeCharts(value: unknown): JournalChart[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Partial<JournalChart>;
      const id = String(row?.id ?? "");
      const name = String(row?.name ?? "");
      const dataUrl = String(row?.dataUrl ?? "");
      if (!id || !name || !dataUrl) return null;
      return { id, name, dataUrl };
    })
    .filter((item): item is JournalChart => !!item);
}

function normalizeInput(input: Partial<JournalInput>): JournalInput {
  const dateKey = String(input.dateKey ?? "");
  if (!dateKey) throw new Error("dateKey is required");
  return {
    dateKey,
    marketBias: String(input.marketBias ?? "").trim(),
    setupFocus: String(input.setupFocus ?? "").trim(),
    invalidation: String(input.invalidation ?? "").trim(),
    riskPlan: String(input.riskPlan ?? "").trim(),
    premarketNotes: String(input.premarketNotes ?? "").trim(),
    postmarketNotes: String(input.postmarketNotes ?? "").trim(),
    charts: normalizeCharts(input.charts ?? []),
  };
}

export async function listJournalEntries(userId: string): Promise<JournalEntry[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("premarket_journal_entries")
    .select("date_key,market_bias,setup_focus,invalidation,risk_plan,premarket_notes,postmarket_notes,charts,updated_at")
    .eq("user_id", userId)
    .order("date_key", { ascending: false })
    .limit(370);

  if (error) {
    if (error.message.includes("premarket_journal_entries")) {
      throw new Error("Table premarket_journal_entries is missing. Run supabase/add_premarket_journal_entries.sql");
    }
    throw new Error(`Failed to load journal entries: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    dateKey: String(row.date_key),
    marketBias: String(row.market_bias ?? ""),
    setupFocus: String(row.setup_focus ?? ""),
    invalidation: String(row.invalidation ?? ""),
    riskPlan: String(row.risk_plan ?? ""),
    premarketNotes: String(row.premarket_notes ?? ""),
    postmarketNotes: String(row.postmarket_notes ?? ""),
    charts: normalizeCharts(row.charts),
    updatedAt: String(row.updated_at ?? ""),
  }));
}

export async function upsertJournalEntry(userId: string, input: Partial<JournalInput>): Promise<JournalEntry> {
  const normalized = normalizeInput(input);
  const supabase = getSupabaseAdmin();
  const payload = {
    user_id: userId,
    date_key: normalized.dateKey,
    market_bias: normalized.marketBias,
    setup_focus: normalized.setupFocus,
    invalidation: normalized.invalidation,
    risk_plan: normalized.riskPlan,
    premarket_notes: normalized.premarketNotes,
    postmarket_notes: normalized.postmarketNotes,
    charts: normalized.charts,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("premarket_journal_entries").upsert(payload, { onConflict: "user_id,date_key" });
  if (error) {
    if (error.message.includes("premarket_journal_entries")) {
      throw new Error("Table premarket_journal_entries is missing. Run supabase/add_premarket_journal_entries.sql");
    }
    throw new Error(`Failed to save journal entry: ${error.message}`);
  }

  return {
    ...normalized,
    updatedAt: payload.updated_at,
  };
}

export async function deleteJournalEntry(userId: string, dateKey: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("premarket_journal_entries").delete().eq("user_id", userId).eq("date_key", dateKey);
  if (error) {
    throw new Error(`Failed to delete journal entry: ${error.message}`);
  }
}

