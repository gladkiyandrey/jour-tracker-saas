"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from "./TrackerClient.module.css";

type Variant = "neg" | "pos" | "pos-outline";
type Entry = { result: -1 | 1; variant: Variant; deposit: number; trades: number };
type ChartHover = {
  x: number;
  y: number;
  day: number;
  deposit: number;
  trades: number;
  variant: Variant | "none";
};

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
  const smoothFactor = 8; // slightly softer bends while preserving overall shape

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / smoothFactor;
    const cp1y = p1.y + (p2.y - p0.y) / smoothFactor;
    const cp2x = p2.x - (p3.x - p1.x) / smoothFactor;
    const cp2y = p2.y - (p3.y - p1.y) / smoothFactor;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

export default function TrackerClient({ userKey }: Props) {
  const now = new Date();
  const viewStateKey = `jour-tracker-view-${userKey}`;
  const [viewYear, setViewYear] = useState<number>(() => {
    if (typeof window === "undefined") return now.getFullYear();
    try {
      const raw = localStorage.getItem(viewStateKey);
      if (!raw) return now.getFullYear();
      const parsed = JSON.parse(raw) as { year?: number };
      return typeof parsed.year === "number" && Number.isInteger(parsed.year) ? parsed.year : now.getFullYear();
    } catch {
      return now.getFullYear();
    }
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (typeof window === "undefined") return now.getMonth();
    try {
      const raw = localStorage.getItem(viewStateKey);
      if (!raw) return now.getMonth();
      const parsed = JSON.parse(raw) as { month?: number };
      return typeof parsed.month === "number" && Number.isInteger(parsed.month) && parsed.month >= 0 && parsed.month <= 11
        ? parsed.month
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
  const [chartHover, setChartHover] = useState<ChartHover | null>(null);

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
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    const values = sortedEntries
      .filter(([dateKey]) => dateKey.startsWith(monthPrefix))
      .map(([, value]) => value);
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

    let advice =
      "Track at least 5 days to unlock a reliable recommendation. Keep entries consistent for a clearer pattern. Fill both result and deposit to improve accuracy.";
    if (total >= 5) {
      if (score >= 75 && greenStreak >= 4) {
        advice =
          "Strong consistency. Keep the same routine and protect your streak by limiting impulsive entries. Use the same risk per trade to avoid variance spikes. Review only your best setups and repeat what already works.";
      } else if (redStreak >= 3) {
        advice =
          "Red streak is growing. Reduce position size for the next sessions and trade only A+ setups. Pause after two consecutive losses to reset execution quality. Focus on one pattern and skip marginal entries this week.";
      } else if (score >= 60) {
        advice =
          "Progress is stable. Focus on avoiding single emotional days that break momentum. Lock your max trades limit before the session starts. Keep a brief post-trade note to catch repeated mistakes early.";
      } else {
        advice =
          "Discipline is unstable. Use a strict daily checklist and cap risk until score recovers. Reduce frequency and prioritize quality over activity. Aim for three clean sessions in a row before increasing risk.";
      }
    }

    return { score, greenStreak, redStreak, advice };
  }, [sortedEntries, viewMonth, viewYear]);

  const monthlyReview = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    const monthItems = sortedEntries
      .filter(([dateKey]) => dateKey.startsWith(monthPrefix))
      .map(([dateKey, entry]) => ({ dateKey, ...entry }));
    const values = monthItems;

    if (!values.length) {
      return {
        avgTrades: "0.0",
        bestDay: "-",
        worstDay: "-",
        maxDrawdown: "0.0%",
        adherence: "0%",
      };
    }

    const avgTrades = (
      values.reduce((acc, day) => acc + (Number(day.trades) || 0), 0) / values.length
    ).toFixed(1);

    let peak = Number(values[0].deposit) || 0;
    let maxDrawdownPct = 0;
    for (const day of values) {
      const dep = Number(day.deposit) || 0;
      if (dep > peak) peak = dep;
      if (peak > 0) {
        const dd = ((peak - dep) / peak) * 100;
        if (dd > maxDrawdownPct) maxDrawdownPct = dd;
      }
    }

    const deltas = values.map((day, index) => {
      if (index === 0) return { day: day.dateKey, delta: 0 };
      const prev = Number(values[index - 1].deposit) || 0;
      const curr = Number(day.deposit) || 0;
      return { day: day.dateKey, delta: curr - prev };
    });
    const best = deltas.reduce((a, b) => (b.delta > a.delta ? b : a), deltas[0]);
    const worst = deltas.reduce((a, b) => (b.delta < a.delta ? b : a), deltas[0]);

    const adherentDays = values.filter((day) => {
      const isOutline = day.variant === "pos-outline";
      const trades = Number(day.trades) || 0;
      const withinTradeLimit = isOutline ? trades === 0 : trades <= 2;
      return day.variant !== "neg" && withinTradeLimit;
    }).length;
    const adherence = `${Math.round((adherentDays / values.length) * 100)}%`;

    const weekdayShort = (dateKey: string) => {
      const date = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleDateString("en-US", { weekday: "long" });
    };

    const shortDay = (dateKey: string) => {
      const d = Number(dateKey.slice(-2));
      return Number.isFinite(d) ? `${d}` : "-";
    };

    return {
      avgTrades,
      bestDay: best
        ? `${weekdayShort(best.day)} ${shortDay(best.day)} (${best.delta >= 0 ? "+$" : "-$"}${Math.abs(Math.round(best.delta))})`
        : "-",
      worstDay: worst
        ? `${weekdayShort(worst.day)} ${shortDay(worst.day)} (${worst.delta >= 0 ? "+$" : "-$"}${Math.abs(Math.round(worst.delta))})`
        : "-",
      maxDrawdown: `${maxDrawdownPct.toFixed(1)}%`,
      adherence,
    };
  }, [sortedEntries, viewMonth, viewYear]);

  const chartModel = useMemo(() => {
    const bounds = { left: 42, right: 478, top: 28, bottom: 220 };
    const gridY = [28, 76, 124, 172, 220];
    const TRADE_BAR_UNIT = 12; // fixed px per 1 trade
    const TRADE_BAR_CAP = 8; // visual cap, tooltip still shows real value
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    const monthEntries = sortedEntries.filter(([dateKey]) => dateKey.startsWith(monthPrefix));
    const filledEntries = monthEntries;

    let cumulative = 0;
    const visible: Array<{
      day: number;
      cumulative: number;
      deposit: number;
      trades: number;
      variant: Variant | "none";
    }> = filledEntries.map(([dateKey, entry]) => {
      const dayScore = entry.variant === "neg" ? -1 : entry.variant === "pos-outline" ? 0.5 : 1;
      cumulative += dayScore;
      return {
        day: Number(dateKey.slice(-2)),
        cumulative,
        deposit: Number(entry.deposit) || 0,
        trades: Number(entry.trades) || 0,
        variant: entry.variant,
      };
    });

    const hasAnyData = visible.length > 0;
    if (!hasAnyData) {
      return {
        yellow: "",
        blue: "",
        bars: [] as Array<{ x: number; y: number; w: number; h: number; kind: "zero" | "ok" | "warn" | "hot"; day: number; deposit: number; trades: number; variant: Variant | "none" }>,
        ticks: [] as Array<{ x: number; label: string }>,
        yTicksLeft: [] as Array<{ y: number; label: string }>,
        bounds,
        gridY,
      };
    }

    const resultValues = visible.map((v) => v.cumulative);
    const depositValues = visible.map((v) => v.deposit);
    const minDeposit = Math.min(...depositValues);
    const maxDeposit = Math.max(...depositValues);
    const CENTER = 50;
    const DISPLAY_MIN = 10;
    const DISPLAY_MAX = 90;
    const normalizeFromBaseline = (values: number[], padding = 0) => {
      if (!values.length) return [];
      const base = values[0];
      const deltas = values.map((value) => value - base);
      const maxAbs = Math.max(1, ...deltas.map((delta) => Math.abs(delta)));
      const halfRange = (DISPLAY_MAX - DISPLAY_MIN) / 2;
      const scale = maxAbs * (1 + padding);
      return deltas.map((delta) => CENTER + (delta / scale) * halfRange);
    };
    const limitLocalSlope = (values: number[], maxStep = 14) => {
      if (values.length < 2) return values;
      const out = [...values];
      for (let i = 1; i < out.length; i += 1) {
        const diff = out[i] - out[i - 1];
        if (Math.abs(diff) > maxStep) {
          out[i] = out[i - 1] + Math.sign(diff) * maxStep;
        }
      }
      return out;
    };

    const normalizedDeposit = normalizeFromBaseline(depositValues, 0.08);
    const normalizedResultRaw = normalizeFromBaseline(resultValues, 0.1);
    const normalizedResult = limitLocalSlope(normalizedResultRaw, 14);

    const steps = visible.length > 1 ? visible.length - 1 : 1;
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    const tradeMaxHeight = Math.min(height, TRADE_BAR_UNIT * TRADE_BAR_CAP);
    const barWidth = Math.max(4, Math.min(12, width / Math.max(visible.length * 1.8, 1)));
    const bars = visible.map((v, index) => {
      const x = bounds.left + (width * index) / steps - barWidth / 2;
      const cappedTrades = Math.max(0, Math.min(v.trades, TRADE_BAR_CAP));
      const h = cappedTrades === 0 ? 3 : Math.min(cappedTrades * TRADE_BAR_UNIT, tradeMaxHeight);
      const y = bounds.bottom - h;
      const kind: "zero" | "ok" | "warn" | "hot" =
        v.trades === 0 ? "zero" : v.trades <= 2 ? "ok" : v.trades <= 4 ? "warn" : "hot";
      return { x, y, w: barWidth, h, kind, day: v.day, deposit: v.deposit, trades: v.trades, variant: v.variant };
    });

    const ticks = visible.map((v, index) => {
      const x = bounds.left + (width * index) / steps;
      return { x, label: String(v.day) };
    });

    const yTicksLeft = Array.from({ length: 5 }, (_, i) => {
      const y = bounds.bottom - (height * i) / 4;
      const ratio = i / 4;
      const depositAtY = minDeposit + (maxDeposit - minDeposit) * ratio;
      return { y, label: Math.round(depositAtY).toLocaleString("en-US") };
    });

    return {
      yellow: buildPath(normalizedResult, 0, 100, bounds),
      blue: buildPath(normalizedDeposit, 0, 100, bounds),
      bars,
      ticks,
      yTicksLeft,
      bounds,
      gridY,
    };
  }, [sortedEntries, viewMonth, viewYear]);

  const variantLabel = (variant: Variant | "none") => {
    if (variant === "neg") return "Red day (-1)";
    if (variant === "pos") return "Green day (+1)";
    if (variant === "pos-outline") return "Green outline (+1)";
    return "No day type";
  };

  const getPreviousDayDeposit = (dateKey: string) => {
    const current = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(current.getTime())) return 0;
    const probe = new Date(current);
    for (let i = 0; i < 400; i += 1) {
      probe.setDate(probe.getDate() - 1);
      const key = formatDateKey(probe.getFullYear(), probe.getMonth(), probe.getDate());
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
    const previousDeposit = isOutline ? getPreviousDayDeposit(selectedDateKey) : 0;
    const enteredDeposit = Number(modalDeposit.trim());
    const outlineDeposit = isOutline ? (previousDeposit > 0 ? previousDeposit : enteredDeposit) : enteredDeposit;
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
        setModalError("Enter deposit amount greater than 0.");
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
    setSelectedDateKey("");

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
    setSelectedDateKey("");

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

  const outlinePreviousDeposit = selectedDateKey ? getPreviousDayDeposit(selectedDateKey) : 0;
  const outlineNeedsManualDeposit = modalVariant === "pos-outline" && outlinePreviousDeposit <= 0;

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

          <div className={styles.chartWrap}>
            <svg
              className={styles.chart}
              viewBox="0 0 520 280"
              preserveAspectRatio="none"
              aria-label="Tracker chart"
              onMouseLeave={() => setChartHover(null)}
            >
              <g>
                {chartModel.yTicksLeft.map((tick, index) => (
                  <text key={`y-left-tick-${index}`} className={styles.yTickLabelLeft} x={chartModel.bounds.left - 10} y={tick.y + 3} textAnchor="end">
                    {tick.label}
                  </text>
                ))}
              </g>
              <g>
                {chartModel.gridY.map((y, index) => (
                  <line key={`grid-${index}`} className={styles.gridLine} x1={chartModel.bounds.left} y1={y} x2={chartModel.bounds.right} y2={y} />
                ))}
              </g>
              <g>
                {chartModel.bars.map((bar, index) => (
                  <rect
                    key={`bar-${index}`}
                    className={`${styles.tradeBar} ${
                      bar.kind === "zero"
                        ? styles.tradeBarZero
                        : bar.kind === "ok"
                          ? styles.tradeBarOk
                          : bar.kind === "warn"
                            ? styles.tradeBarWarn
                            : styles.tradeBarHot
                    }`}
                    x={bar.x}
                    y={bar.y}
                    width={bar.w}
                    height={bar.h}
                    rx="2"
                    onMouseMove={(event) => {
                      const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      if (!rect) return;
                      setChartHover({
                        x: event.clientX - rect.left + 10,
                        y: event.clientY - rect.top - 8,
                        day: bar.day,
                        deposit: bar.deposit,
                        trades: bar.trades,
                        variant: bar.variant,
                      });
                    }}
                    onMouseLeave={() => setChartHover(null)}
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
            </svg>
            {chartHover ? (
              <div className={styles.chartTooltip} style={{ left: `${chartHover.x}px`, top: `${chartHover.y}px` }}>
                <div>Day: {chartHover.day}</div>
                <div>Type: {variantLabel(chartHover.variant)}</div>
                <div>Trades: {chartHover.trades}</div>
                <div>Deposit: {Math.round(chartHover.deposit)}</div>
              </div>
            ) : null}
          </div>

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

      <div className={styles.monthlyRow}>
        <div className={`${styles.panel} ${styles.weekly}`}>
          <h4>Monthly review</h4>
          <div className={styles.weeklyGrid}>
            <div className={styles.weeklyItem}>
              <span>Avg trades/day</span>
              <strong>{monthlyReview.avgTrades}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <span>Best day</span>
              <strong>{monthlyReview.bestDay}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <span>Worst day</span>
              <strong>{monthlyReview.worstDay}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <span>Max drawdown</span>
              <strong>{monthlyReview.maxDrawdown}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <span>Rule adherence</span>
              <strong>{monthlyReview.adherence}</strong>
            </div>
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
                placeholder={
                  modalVariant === "pos-outline"
                    ? outlineNeedsManualDeposit
                      ? "No previous day found, enter deposit"
                      : "Auto from previous day"
                    : "Enter deposit amount"
                }
                value={modalDeposit}
                readOnly={modalVariant === "pos-outline" && !outlineNeedsManualDeposit}
                onChange={(e) => {
                  if (modalVariant === "pos-outline" && !outlineNeedsManualDeposit) return;
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
                Clear day
              </button>
              <div className={styles.actionsRight}>
                <button className="btn" type="button" onClick={closeModal}>
                  Cancel
                </button>
                <button className="btn primary" type="button" onClick={saveDay}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
