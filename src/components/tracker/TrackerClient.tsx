"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from "./TrackerClient.module.css";

type Variant = "neg" | "pos" | "pos-outline";
type Entry = { result: -1 | 1; variant: Variant; deposit: number; trades: number };

type Props = {
  userKey: string;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildPath(
  values: number[],
  minY: number,
  maxY: number,
  bounds = { left: 10, right: 510, top: 28, bottom: 220 }
) {
  if (!values.length) return "";

  const { left, right, top, bottom } = bounds;
  const width = right - left;
  const height = bottom - top;
  const steps = values.length > 1 ? values.length - 1 : 1;

  const points = values.map((value, index) => {
    const x = left + (width * index) / steps;
    const safeRange = maxY - minY || 1;
    const ratio = (value - minY) / safeRange;
    const y = bottom - ratio * height;
    return { x, y };
  });

  if (points.length < 3) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

export default function TrackerClient({ userKey }: Props) {
  const now = new Date();
  const viewStateKey = `jour-tracker-view-${userKey}`;
  const [viewYear, setViewYear] = useState(() => {
    if (typeof window === "undefined") return now.getFullYear();
    try {
      const raw = localStorage.getItem(viewStateKey);
      if (!raw) return now.getFullYear();
      const parsed = JSON.parse(raw) as { year?: number };
      return Number.isInteger(parsed.year) ? parsed.year : now.getFullYear();
    } catch {
      return now.getFullYear();
    }
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (typeof window === "undefined") return now.getMonth();
    try {
      const raw = localStorage.getItem(viewStateKey);
      if (!raw) return now.getMonth();
      const parsed = JSON.parse(raw) as { month?: number };
      return Number.isInteger(parsed.month) && (parsed.month ?? -1) >= 0 && (parsed.month ?? 12) <= 11
        ? (parsed.month as number)
        : now.getMonth();
    } catch {
      return now.getMonth();
    }
  });
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [dayData, setDayData] = useState<Record<string, Entry>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(`jour-tracker-${userKey}`);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, Partial<Entry>>;
      const normalized: Record<string, Entry> = {};

      Object.entries(parsed).forEach(([dateKey, value]) => {
        const variant: Variant =
          value.variant === "neg" || value.variant === "pos" || value.variant === "pos-outline"
            ? value.variant
            : Number(value.result) === -1
              ? "neg"
              : "pos";

        const depositNum = Number(value.deposit);
        const tradesNum = Number(value.trades);
        normalized[dateKey] = {
          result: variant === "neg" ? -1 : 1,
          variant,
          deposit: Number.isFinite(depositNum) && depositNum >= 0 ? depositNum : 0,
          trades: Number.isFinite(tradesNum) && tradesNum >= 0 ? Math.floor(tradesNum) : 0,
        };
      });

      return normalized;
    } catch {
      return {};
    }
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalVariant, setModalVariant] = useState<Variant | "">("");
  const [modalDeposit, setModalDeposit] = useState("");
  const [modalTrades, setModalTrades] = useState("");
  const [modalError, setModalError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [copyFlash, setCopyFlash] = useState(false);

  const storageKey = `jour-tracker-${userKey}`;

  useEffect(() => {
    let cancelled = false;

    const loadFromServer = async () => {
      try {
        const res = await fetch("/api/tracker/entries", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) return;
          const errPayload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errPayload?.error || `Failed to load (${res.status})`);
        }
        const payload = (await res.json()) as { data?: Record<string, Entry> };
        if (!cancelled && payload.data) {
          setDayData(payload.data);
          setSyncError("");
          try {
            localStorage.setItem(storageKey, JSON.stringify(payload.data));
          } catch {
            // ignore storage errors
          }
        }
      } catch (error) {
        if (!cancelled) {
          const msg = error instanceof Error ? error.message : "";
          setSyncError(msg ? `Cloud sync error: ${msg}` : "Cloud sync is temporarily unavailable.");
        }
      }
    };

    loadFromServer();
    return () => {
      cancelled = true;
    };
  }, [storageKey, userKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(dayData));
    } catch {
      // ignore storage errors
    }
  }, [dayData, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(viewStateKey, JSON.stringify({ year: viewYear, month: viewMonth }));
    } catch {
      // ignore storage errors
    }
  }, [viewMonth, viewStateKey, viewYear]);

  const sortedEntries = useMemo(
    () => Object.entries(dayData).sort(([a], [b]) => a.localeCompare(b)),
    [dayData]
  );

  const stats = useMemo(() => {
    const values = sortedEntries.map(([, value]) => value);
    const greens = values.filter((v) => v.result === 1).length;
    const reds = values.filter((v) => v.result === -1).length;
    const total = greens + reds;
    const score = total > 0 ? Math.round((greens / total) * 100) : 0;

    let greenStreak = 0;
    let redStreak = 0;
    let currentGreen = 0;
    let currentRed = 0;

    values.forEach((value) => {
      if (value.result === 1) {
        currentGreen += 1;
        currentRed = 0;
        greenStreak = Math.max(greenStreak, currentGreen);
      } else {
        currentRed += 1;
        currentGreen = 0;
        redStreak = Math.max(redStreak, currentRed);
      }
    });

    let advice = "Track at least 5 days to get a practical discipline recommendation.";
    if (total >= 5) {
      if (score >= 75 && greenStreak >= 4) {
        advice = "Strong consistency. Keep the same routine and protect your streak by limiting impulsive entries.";
      } else if (redStreak >= 3) {
        advice = "Red streak is growing. Reduce position size for the next sessions and trade only A+ setups.";
      } else if (score >= 60) {
        advice = "Progress is stable. Focus on avoiding single emotional days that break momentum.";
      } else {
        advice = "Discipline is unstable. Use a strict daily checklist and cap risk until score recovers.";
      }
    }

    return { score, greenStreak, redStreak, advice };
  }, [sortedEntries]);

  const chartModel = useMemo(() => {
    const bounds = { left: 10, right: 510, top: 28, bottom: 220 };
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    const monthEntries = sortedEntries.filter(([dateKey]) => dateKey.startsWith(monthPrefix));

    if (!monthEntries.length) {
      return { yellow: "", blue: "", bars: [] as Array<{ x: number; y: number; w: number; h: number; kind: "ok" | "warn" | "hot" }>, ticks: [] as Array<{ x: number; label: string }>, maxTrades: 0, minDeposit: 0, maxDeposit: 0 };
    }

    let cumulative = 0;
    const visible = monthEntries
      .map(([dateKey, entry]) => {
        cumulative += Number(entry.result) || 0;
        return {
          day: Number(dateKey.slice(-2)),
          cumulative,
          deposit: Number(entry.deposit) || 0,
          trades: Number(entry.trades) || 0,
        };
      })
      .slice(-31);

    const resultValues = visible.map((v) => v.cumulative);
    const depositValues = visible.map((v) => v.deposit);
    const tradesValues = visible.map((v) => v.trades);

    const minResult = Math.min(...resultValues, 0);
    const maxResult = Math.max(...resultValues, 1);
    const maxDeposit = Math.max(...depositValues, 1);
    const minDeposit = Math.min(...depositValues, 0);
    const maxTrades = Math.max(...tradesValues, 1);

    const steps = visible.length > 1 ? visible.length - 1 : 1;
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    const barWidth = Math.max(4, Math.min(12, width / Math.max(visible.length * 1.8, 1)));
    const bars = visible.map((v, index) => {
      const x = bounds.left + (width * index) / steps - barWidth / 2;
      const ratio = maxTrades > 0 ? v.trades / maxTrades : 0;
      const y = bounds.bottom - ratio * height;
      const h = bounds.bottom - y;
      const kind: "ok" | "warn" | "hot" = v.trades <= 2 ? "ok" : v.trades <= 4 ? "warn" : "hot";
      return { x, y, w: barWidth, h, kind };
    });

    const tickIndexes = Array.from(new Set([0, Math.floor((visible.length - 1) / 2), visible.length - 1])).filter((v) => v >= 0);
    const ticks = tickIndexes.map((idx) => {
      const x = bounds.left + (width * idx) / steps;
      return { x, label: String(visible[idx]?.day ?? "") };
    });

    return {
      yellow: buildPath(resultValues, minResult, maxResult, bounds),
      blue: buildPath(depositValues, minDeposit, maxDeposit, bounds),
      bars,
      ticks,
      maxTrades,
      minDeposit,
      maxDeposit,
    };
  }, [sortedEntries, viewMonth, viewYear]);

  const getPreviousDayDeposit = (dateKey: string) => {
    const current = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(current.getTime())) return 0;
    const probe = new Date(current);
    for (let i = 0; i < 400; i += 1) {
      probe.setDate(probe.getDate() - 1);
      const key = probe.toISOString().slice(0, 10);
      const prev = dayData[key];
      if (prev && Number.isFinite(prev.deposit) && prev.deposit > 0) {
        return prev.deposit;
      }
    }
    return 0;
  };

  const openModal = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    const current = dayData[dateKey];
    setModalVariant(current?.variant ?? "");
    setModalDeposit(current?.deposit && current.deposit > 0 ? String(current.deposit) : "");
    if (current?.variant === "pos-outline") {
      setModalTrades("0");
    } else {
      setModalTrades(current?.trades && current.trades > 0 ? String(current.trades) : "");
    }
    setModalError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalError("");
  };

  const saveDay = async () => {
    if (!selectedDateKey) return;
    const isOutline = modalVariant === "pos-outline";
    const outlineDeposit = isOutline ? getPreviousDayDeposit(selectedDateKey) : Number(modalDeposit.trim());
    const deposit = outlineDeposit;
    const trades = isOutline ? 0 : Number(modalTrades.trim());
    const hasVariant = modalVariant === "neg" || modalVariant === "pos" || modalVariant === "pos-outline";
    const hasDeposit = Number.isFinite(deposit) && deposit > 0;
    const hasTrades = Number.isFinite(trades) && (isOutline ? trades >= 0 : trades > 0);

    if (!hasVariant || !hasDeposit || !hasTrades) {
      if (!hasVariant && !hasDeposit && !hasTrades) {
        setModalError("Choose day type, enter deposit and trades count.");
      } else if (!hasVariant) {
        setModalError("Choose day type.");
      } else if (!hasDeposit) {
        setModalError(isOutline ? "No previous day with deposit found. Set deposit on a previous day first." : "Enter deposit amount greater than 0.");
      } else {
        setModalError(isOutline ? "For outlined green day, trades can be 0 or more." : "Enter trades count greater than 0.");
      }
      return;
    }

    setModalError("");
    const variant = modalVariant as Variant;
    const nextEntry: Entry = {
      result: variant === "neg" ? -1 : 1,
      variant,
      deposit,
      trades: Math.floor(trades),
    };

    setDayData((prev) => ({
      ...prev,
      [selectedDateKey]: nextEntry,
    }));
    setModalOpen(false);

    try {
      const res = await fetch("/api/tracker/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateKey: selectedDateKey,
          result: nextEntry.result,
          variant: nextEntry.variant,
          deposit: nextEntry.deposit,
          trades: nextEntry.trades,
        }),
      });
      if (!res.ok) {
        throw new Error(`Failed to save (${res.status})`);
      }
      setSyncError("");
    } catch {
      setSyncError("Saved locally, but cloud sync failed. Try again.");
    }
  };

  const clearDay = async () => {
    if (!selectedDateKey) return;

    setDayData((prev) => {
      const next = { ...prev };
      delete next[selectedDateKey];
      return next;
    });
    setModalOpen(false);
    setModalError("");

    try {
      const res = await fetch("/api/tracker/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateKey: selectedDateKey }),
      });
      if (!res.ok) {
        throw new Error(`Failed to clear (${res.status})`);
      }
      setSyncError("");
    } catch {
      setSyncError("Cleared locally, but cloud sync failed. Try again.");
    }
  };

  const renderDayClass = (entry: Entry | undefined, isSelected: boolean) => {
    const classes = [styles.day];
    if (!entry) {
      if (isSelected) classes.push(styles.daySelected);
      return classes.join(" ");
    }

    if (entry.result === -1) classes.push(styles.dayNeg);
    if (entry.variant === "pos") classes.push(styles.dayPos);
    if (entry.variant === "pos-outline") classes.push(styles.dayPosOutline);
    if (entry.variant === "pos" && isSelected) classes.push(styles.dayPosSelected);
    if (isSelected) classes.push(styles.daySelected);

    return classes.join(" ");
  };

  const calendarCells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const firstDay = (first.getDay() + 6) % 7;
    const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [] as Array<
      | { kind: "empty" }
      | { kind: "day"; day: number; dateKey: string; entry?: Entry; isSelected: boolean }
    >;

    for (let i = 0; i < 42; i += 1) {
      if (i < firstDay || i >= firstDay + lastDate) {
        cells.push({ kind: "empty" });
      } else {
        const day = i - firstDay + 1;
        const dateKey = formatDateKey(viewYear, viewMonth, day);
        cells.push({
          kind: "day",
          day,
          dateKey,
          entry: dayData[dateKey],
          isSelected: dateKey === selectedDateKey,
        });
      }
    }

    return cells;
  }, [viewMonth, viewYear, dayData, selectedDateKey]);

  const createShare = async () => {
    setShareStatus("");
    setShareLink("");
    setShareLoading(true);
    try {
      const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
      const monthEntries = sortedEntries.filter(([dateKey]) => dateKey.startsWith(monthPrefix));
      const days = monthEntries.map(([dateKey, entry]) => ({
        day: Number(dateKey.slice(-2)),
        variant: entry.variant,
      }));

      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: viewYear,
          month: viewMonth,
          score: stats.score,
          greenStreak: stats.greenStreak,
          redStreak: stats.redStreak,
          chartYellow: chartModel.yellow,
          chartBlue: chartModel.blue,
          days,
        }),
      });
      if (!res.ok) {
        const errPayload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errPayload?.error || "Failed to create share link");
      }
      const payload = (await res.json()) as { url?: string };
      if (!payload.url) throw new Error("Invalid share response");
      setShareLink(payload.url);
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(payload.url);
          setShareStatus("Copied. Share it anywhere.");
        } else {
          setShareStatus("Link ready. Copy manually below.");
        }
      } catch {
        setShareStatus("Link ready. Copy manually below.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      setShareStatus(`Error: ${message}`);
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareLink);
        setShareStatus("Copied. Share it anywhere.");
        setCopyFlash(true);
        window.setTimeout(() => setCopyFlash(false), 700);
      }
    } catch {
      setShareStatus("Auto-copy failed. Copy it manually.");
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modalOpen) {
        setModalOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalOpen]);

  return (
    <section className={styles.wrapper}>
      <div className={styles.tracker}>
        <div className={`${styles.panel} ${styles.mainPanel}`}>
          <div className={styles.head}>
            <h2>Day Tracker</h2>
            {syncError ? <p className={styles.syncError}>{syncError}</p> : null}
          </div>

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <i className={`${styles.legendLine} ${styles.legendYellow}`} /> Consistency
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendLine} ${styles.legendBlue}`} /> Deposit size
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendBar} ${styles.legendBarTrades}`} /> Trades / day
            </span>
          </div>

          <svg className={styles.chart} viewBox="0 0 520 280" preserveAspectRatio="none" aria-label="Tracker chart">
            <g>
              <line className={styles.gridLine} x1="10" y1="28" x2="510" y2="28" />
              <line className={styles.gridLine} x1="10" y1="76" x2="510" y2="76" />
              <line className={styles.gridLine} x1="10" y1="124" x2="510" y2="124" />
              <line className={styles.gridLine} x1="10" y1="172" x2="510" y2="172" />
              <line className={styles.gridLine} x1="10" y1="220" x2="510" y2="220" />
            </g>
            <g>
              {chartModel.bars.map((bar, index) => (
                <rect
                  key={`bar-${index}`}
                  className={`${styles.tradeBar} ${bar.kind === "ok" ? styles.tradeBarOk : bar.kind === "warn" ? styles.tradeBarWarn : styles.tradeBarHot}`}
                  x={bar.x}
                  y={bar.y}
                  width={bar.w}
                  height={Math.max(0, bar.h)}
                  rx="2"
                />
              ))}
            </g>
            <path className={styles.yellowGlow} d={chartModel.yellow} />
            <path className={styles.blueGlow} d={chartModel.blue} />
            <path className={`${styles.line} ${styles.yellow}`} d={chartModel.yellow} />
            <path className={`${styles.line} ${styles.blue}`} d={chartModel.blue} />
            {chartModel.ticks.map((tick, index) => (
              <text key={`tick-${index}`} className={styles.tickLabel} x={tick.x} y={244} textAnchor="middle">
                {tick.label}
              </text>
            ))}
            <text className={styles.axisHint} x={10} y={258}>
              Open dates (day of month)
            </text>
            <text className={styles.axisHint} x={510} y={258} textAnchor="end">
              Deposit range: {Math.round(chartModel.minDeposit)} - {Math.round(chartModel.maxDeposit)}
            </text>
            <text className={styles.axisHint} x={510} y={20} textAnchor="end">
              Trades scale: 0 - {chartModel.maxTrades}
            </text>
          </svg>

          <div className={styles.scoreRow}>
            <div className={`${styles.score} ${styles.scoreBlue}`}>
              <span>DISCIPLINE SCORE</span>
              <strong>{stats.score}%</strong>
            </div>
            <div className={`${styles.score} ${styles.scoreGreen}`}>
              <span>GREEN STREAK</span>
              <strong>{stats.greenStreak}</strong>
            </div>
            <div className={`${styles.score} ${styles.scoreRed}`}>
              <span>RED STREAK</span>
              <strong>{stats.redStreak}</strong>
            </div>
          </div>

        </div>

        <div className={styles.side}>
          <div className={styles.panel}>
            <div className={styles.calendarHead}>
              <button
                type="button"
                className={styles.arrow}
                aria-label="Previous month"
                onClick={() => {
                  setViewMonth((prev) => {
                    if (prev === 0) {
                      setViewYear((y) => y - 1);
                      return 11;
                    }
                    return prev - 1;
                  });
                }}
              >
                ‹
              </button>
              <h3>{monthNames[viewMonth]} {viewYear}</h3>
              <button
                type="button"
                className={styles.arrow}
                aria-label="Next month"
                onClick={() => {
                  setViewMonth((prev) => {
                    if (prev === 11) {
                      setViewYear((y) => y + 1);
                      return 0;
                    }
                    return prev + 1;
                  });
                }}
              >
                ›
              </button>
            </div>

            <div className={styles.weekdays}>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            <div className={styles.calendarGrid}>
              {calendarCells.map((cell, index) => {
                if (cell.kind === "empty") {
                  return (
                    <button key={`empty-${index}`} className={`${styles.day} ${styles.dayEmpty}`} type="button" />
                  );
                }

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    className={renderDayClass(cell.entry, cell.isSelected)}
                    onClick={() => openModal(cell.dateKey)}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`${styles.panel} ${styles.ai}`}>
            <h4>
              <Image className={styles.aiIcon} src="/Group.svg" alt="" aria-hidden width={28} height={28} /> AI discipline advice
            </h4>
            <p>{stats.advice}</p>
          </div>
        </div>
      </div>

      <div className={styles.shareRow}>
        <div />
        <div className={styles.shareBar}>
          <div className={styles.shareInline}>
            <button className={`btn primary ${styles.shareBtn}`} type="button" onClick={createShare} disabled={shareLoading}>
              {shareLoading ? "Creating..." : "Share sequence"}
            </button>
            <span className={styles.shareStatus}>{shareStatus}</span>
          </div>
          {shareLink ? (
            <div className={styles.shareManualRow}>
              <input className={styles.shareInput} type="text" value={shareLink} readOnly onFocus={(e) => e.currentTarget.select()} />
              <button className={`btn ${copyFlash ? styles.copyOk : ""}`} type="button" onClick={copyShareLink}>
                Copy
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {modalOpen ? (
        <div className={styles.modalBackdrop} onClick={closeModal} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Day settings</h3>
            <p className={styles.modalDate}>{selectedDateKey}</p>

            <label className={styles.field}>
              <span>Result</span>
              <div className={styles.colorOptions}>
                <label className={styles.colorOption}>
                  <input
                    type="radio"
                    name="resultVariant"
                    value="neg"
                    checked={modalVariant === "neg"}
                    onChange={() => {
                      setModalVariant("neg");
                      setModalError("");
                    }}
                  />
                  <span className={`${styles.colorSwatch} ${styles.swatchRed}`} />
                </label>
                <label className={styles.colorOption}>
                  <input
                    type="radio"
                    name="resultVariant"
                    value="pos"
                    checked={modalVariant === "pos"}
                    onChange={() => {
                      setModalVariant("pos");
                      setModalError("");
                    }}
                  />
                  <span className={`${styles.colorSwatch} ${styles.swatchGreen}`} />
                </label>
                <label className={styles.colorOption}>
                  <input
                    type="radio"
                    name="resultVariant"
                    value="pos-outline"
                    checked={modalVariant === "pos-outline"}
                    onChange={() => {
                      setModalVariant("pos-outline");
                      const prevDeposit = selectedDateKey ? getPreviousDayDeposit(selectedDateKey) : 0;
                      setModalDeposit(prevDeposit > 0 ? String(prevDeposit) : "");
                      setModalTrades("0");
                      setModalError("");
                    }}
                  />
                  <span className={`${styles.colorSwatch} ${styles.swatchGreenOutline}`} />
                </label>
              </div>
            </label>

            <label className={styles.field}>
              <span>Deposit size</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={modalVariant === "pos-outline" ? "Auto from previous day" : "Enter deposit amount"}
                value={modalDeposit}
                readOnly={modalVariant === "pos-outline"}
                onChange={(e) => {
                  if (modalVariant === "pos-outline") return;
                  setModalDeposit(e.target.value.replace(/\D/g, ""));
                  setModalError("");
                }}
              />
            </label>

            <label className={styles.field}>
              <span>Opened trades (count)</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="1, 2, 3..."
                value={modalTrades}
                readOnly={modalVariant === "pos-outline"}
                onChange={(e) => {
                  if (modalVariant === "pos-outline") return;
                  setModalTrades(e.target.value.replace(/\D/g, ""));
                  setModalError("");
                }}
              />
            </label>

            {modalError ? <p className={styles.modalError}>{modalError}</p> : null}

            <div className={styles.actions}>
              <button className={`btn ${styles.clearBtn}`} type="button" onClick={clearDay}>
                Стереть день
              </button>
              <button className="btn" type="button" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn primary" type="button" onClick={saveDay}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
