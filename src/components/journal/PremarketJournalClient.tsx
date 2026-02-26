"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./PremarketJournalClient.module.css";
import type { Locale } from "@/lib/i18n";

type ChartItem = { id: string; name: string; dataUrl: string };
type Entry = {
  dateKey: string;
  marketBias: string;
  setupFocus: string;
  invalidation: string;
  riskPlan: string;
  premarketNotes: string;
  postmarketNotes: string;
  charts: ChartItem[];
  updatedAt: string;
};

type Props = {
  locale: Locale;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function PremarketJournalClient({ locale }: Props) {
  const t = useMemo(() => {
    if (locale === "ru") {
      return {
        title: "Premarket Journal",
        subtitle: "Планируй день до открытия рынка, фиксируй исполнение и загружай чарты.",
        date: "Дата",
        marketBias: "Bias рынка",
        setupFocus: "Сценарии и сетапы",
        invalidation: "Инвалидация (что отменяет план)",
        riskPlan: "Риск-план",
        preNotes: "Premarket notes",
        postNotes: "Postmarket notes",
        charts: "Чарты",
        upload: "Загрузить чарты",
        clearImages: "Очистить чарты",
        save: "Сохранить план",
        delete: "Удалить день",
        loading: "Загрузка...",
        saved: "План сохранен",
        deleted: "День удален",
        empty: "Пока нет записей. Начни с плана на сегодня.",
        history: "История дней",
        open: "Открыть",
        fileHint: "PNG/JPG, до 2MB на файл, до 6 файлов.",
      };
    }
    if (locale === "uk") {
      return {
        title: "Premarket Journal",
        subtitle: "Плануй день до відкриття ринку, фіксуй виконання та завантажуй чарти.",
        date: "Дата",
        marketBias: "Bias ринку",
        setupFocus: "Сценарії та сетапи",
        invalidation: "Інвалідація (що скасовує план)",
        riskPlan: "Ризик-план",
        preNotes: "Premarket notes",
        postNotes: "Postmarket notes",
        charts: "Чарти",
        upload: "Завантажити чарти",
        clearImages: "Очистити чарти",
        save: "Зберегти план",
        delete: "Видалити день",
        loading: "Завантаження...",
        saved: "План збережено",
        deleted: "День видалено",
        empty: "Поки немає записів. Почни з плану на сьогодні.",
        history: "Історія днів",
        open: "Відкрити",
        fileHint: "PNG/JPG, до 2MB на файл, до 6 файлів.",
      };
    }
    return {
      title: "Premarket Journal",
      subtitle: "Plan your day before market open, track execution, and upload charts.",
      date: "Date",
      marketBias: "Market bias",
      setupFocus: "Scenarios and setups",
      invalidation: "Invalidation (what breaks the plan)",
      riskPlan: "Risk plan",
      preNotes: "Premarket notes",
      postNotes: "Postmarket notes",
      charts: "Charts",
      upload: "Upload charts",
      clearImages: "Clear charts",
      save: "Save plan",
      delete: "Delete day",
      loading: "Loading...",
      saved: "Plan saved",
      deleted: "Day deleted",
      empty: "No entries yet. Start with today premarket plan.",
      history: "Day history",
      open: "Open",
      fileHint: "PNG/JPG, max 2MB per file, up to 6 files.",
    };
  }, [locale]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [form, setForm] = useState<Entry>({
    dateKey: todayKey(),
    marketBias: "",
    setupFocus: "",
    invalidation: "",
    riskPlan: "",
    premarketNotes: "",
    postmarketNotes: "",
    charts: [],
    updatedAt: "",
  });

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/journal/entries", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as { data?: Entry[]; error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "Failed to load");
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setEntries(rows);
      const existing = rows.find((row) => row.dateKey === form.dateKey);
      if (existing) setForm(existing);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDateChange = (dateKey: string) => {
    const found = entries.find((row) => row.dateKey === dateKey);
    if (found) {
      setForm(found);
      return;
    }
    setForm({
      dateKey,
      marketBias: "",
      setupFocus: "",
      invalidation: "",
      riskPlan: "",
      premarketNotes: "",
      postmarketNotes: "",
      charts: [],
      updatedAt: "",
    });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, Math.max(0, 6 - form.charts.length));
    const next: ChartItem[] = [];

    for (const file of list) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 2 * 1024 * 1024) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(file);
      }).catch(() => "");
      if (!dataUrl) continue;
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        dataUrl,
      });
    }

    if (!next.length) return;
    setForm((prev) => ({ ...prev, charts: [...prev.charts, ...next].slice(0, 6) }));
  };

  const save = async () => {
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/journal/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await res.json().catch(() => null)) as { entry?: Entry; error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "Save failed");
      await loadEntries();
      setStatus(t.saved);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removeDay = async () => {
    if (!form.dateKey) return;
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/journal/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateKey: form.dateKey }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "Delete failed");
      await loadEntries();
      onDateChange(form.dateKey);
      setStatus(t.deleted);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.journalLayout}>
      <div className={styles.mainCard}>
        <div className={styles.head}>
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
        </div>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span>{t.date}</span>
            <input type="date" value={form.dateKey} onChange={(e) => onDateChange(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>{t.marketBias}</span>
            <input value={form.marketBias} onChange={(e) => setForm((prev) => ({ ...prev, marketBias: e.target.value }))} />
          </label>
          <label className={`${styles.field} ${styles.full}`}>
            <span>{t.setupFocus}</span>
            <textarea value={form.setupFocus} onChange={(e) => setForm((prev) => ({ ...prev, setupFocus: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>{t.invalidation}</span>
            <textarea value={form.invalidation} onChange={(e) => setForm((prev) => ({ ...prev, invalidation: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>{t.riskPlan}</span>
            <textarea value={form.riskPlan} onChange={(e) => setForm((prev) => ({ ...prev, riskPlan: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>{t.preNotes}</span>
            <textarea value={form.premarketNotes} onChange={(e) => setForm((prev) => ({ ...prev, premarketNotes: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>{t.postNotes}</span>
            <textarea value={form.postmarketNotes} onChange={(e) => setForm((prev) => ({ ...prev, postmarketNotes: e.target.value }))} />
          </label>
        </div>

        <div className={styles.chartsBlock}>
          <div className={styles.chartsHead}>
            <strong>{t.charts}</strong>
            <span>{t.fileHint}</span>
          </div>
          <div className={styles.chartActions}>
            <label className={`btn ${styles.uploadBtn}`}>
              {t.upload}
              <input type="file" accept="image/*" multiple onChange={(e) => handleUpload(e.target.files)} />
            </label>
            <button className="btn" type="button" onClick={() => setForm((prev) => ({ ...prev, charts: [] }))}>
              {t.clearImages}
            </button>
          </div>
          <div className={styles.previewGrid}>
            {form.charts.map((chart) => (
              <div key={chart.id} className={styles.previewItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={chart.dataUrl} alt={chart.name} />
                <button
                  type="button"
                  className={styles.removeChart}
                  onClick={() => setForm((prev) => ({ ...prev, charts: prev.charts.filter((item) => item.id !== chart.id) }))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button className="btn" type="button" onClick={removeDay} disabled={saving}>
            {t.delete}
          </button>
          <button className="btn primary" type="button" onClick={save} disabled={saving}>
            {saving ? t.loading : t.save}
          </button>
        </div>
        {status ? <p className={styles.status}>{status}</p> : null}
      </div>

      <aside className={styles.sideCard}>
        <h3>{t.history}</h3>
        {loading ? <p className={styles.empty}>{t.loading}</p> : null}
        {!loading && entries.length === 0 ? <p className={styles.empty}>{t.empty}</p> : null}
        <div className={styles.historyList}>
          {entries.map((entry) => (
            <button key={entry.dateKey} className={styles.historyItem} type="button" onClick={() => setForm(entry)}>
              <div>
                <strong>{entry.dateKey}</strong>
                <p>{entry.marketBias || "-"}</p>
              </div>
              <span>{t.open}</span>
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}

