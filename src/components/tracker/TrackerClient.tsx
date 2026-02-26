"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from "./TrackerClient.module.css";
import type { Locale } from "@/lib/i18n";

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
type SignalLevel = "ok" | "warn" | "critical";
type SignalItem = {
  key: string;
  level: SignalLevel;
  label: string;
  message: string;
};
type AdviceSnapshot = {
  monthKey: string;
  lastCount: number;
  advice: string;
};

type Props = {
  userKey: string;
  locale: Locale;
};

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
  const smoothFactor = 6;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / smoothFactor;
    const cp2x = p2.x - (p3.x - p1.x) / smoothFactor;
    const minSegY = Math.min(p1.y, p2.y);
    const maxSegY = Math.max(p1.y, p2.y);
    const cp1yRaw = p1.y + (p2.y - p0.y) / smoothFactor;
    const cp2yRaw = p2.y - (p3.y - p1.y) / smoothFactor;
    const cp1y = Math.max(minSegY, Math.min(maxSegY, cp1yRaw));
    const cp2y = Math.max(minSegY, Math.min(maxSegY, cp2yRaw));

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

export default function TrackerClient({ userKey, locale }: Props) {
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
  const [reviewMode, setReviewMode] = useState<"month" | "year">("month");
  const [syncError, setSyncError] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [copyFlash, setCopyFlash] = useState(false);
  const [chartHover, setChartHover] = useState<ChartHover | null>(null);
  const [adviceSnapshot, setAdviceSnapshot] = useState<AdviceSnapshot | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(`jour-ai-advice-${userKey}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<AdviceSnapshot>;
      if (typeof parsed.monthKey !== "string" || typeof parsed.advice !== "string" || typeof parsed.lastCount !== "number") {
        return null;
      }
      return {
        monthKey: parsed.monthKey,
        advice: parsed.advice,
        lastCount: parsed.lastCount,
      };
    } catch {
      return null;
    }
  });
  const chartClipId = useMemo(
    () => `chart-clip-${userKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "default"}`,
    [userKey]
  );
  const ui = useMemo(() => {
    if (locale === "ru") {
      return {
        monthTracker: "Трекер месяца",
        consistency: "Дисциплина",
        depositSize: "Размер депозита",
        tradesPerDay: "Сделок / день",
        day: "День",
        type: "Тип",
        trades: "Сделки",
        deposit: "Депозит",
        disciplineScore: "DISCIPLINE SCORE",
        greenStreak: "GREEN STREAK",
        redStreak: "RED STREAK",
        mon: "Пн",
        tue: "Вт",
        wed: "Ср",
        thu: "Чт",
        fri: "Пт",
        sat: "Сб",
        sun: "Вс",
        aiAdvice: "AI совет по дисциплине",
        reviewMonth: "Месяц",
        reviewYear: "Год",
        monthlyReview: "Обзор месяца",
        yearlyReview: "Обзор года",
        totalTrades: "Сделок за месяц",
        avgTrades: "Сделок в день (сред.)",
        greenPnlSum: "Сумма PnL зеленых",
        redPnlSum: "Сумма PnL красных",
        redDamageShare: "Доля урона красных",
        maxDrawdown: "Макс. просадка",
        totalTradesHint: "Общее количество открытых сделок за выбранный месяц (сумма всех сделок по заполненным дням).",
        avgTradesHint: "Среднее число сделок в день: сделки за месяц / количество заполненных дней.",
        greenPnlSumHint: "Суммарный результат системных дней (зеленый и зеленый с обводкой), рассчитанный по изменению депозита.",
        redPnlSumHint: "Суммарный результат дней с нарушением дисциплины (красные дни), по изменению депозита.",
        redDamageShareHint: "Сколько процентов прибыли зеленых дней съели убытки красных дней. Чем ниже, тем лучше.",
        maxDrawdownHint: "Максимальная просадка депозита от локального пика внутри месяца.",
        signalizer: "Сигнализатор",
        creating: "Создание...",
        shareSequence: "Поделиться серией",
        copy: "Копировать",
        daySettings: "Настройки дня",
        result: "Результат",
        openedTrades: "Открыто сделок (шт)",
        noPrevDay: "Прошлого дня нет, введите депозит",
        autoFromPrev: "Авто из прошлого дня",
        enterDeposit: "Введите сумму депозита",
        clearDay: "Очистить день",
        dayGuideTitle: "Как отмечать день",
        dayGuideGreen: "Зеленый — торговал по плану (PnL может быть и плюс, и минус).",
        dayGuideRed: "Красный — нарушил правила (даже если день был в профит).",
        dayGuideOutline: "Зеленый с обводкой — осознанно пропустил торговлю по правилам.",
        depositGuideTitle: "Какой депозит вводить",
        depositGuideText: "Вводи общий баланс аккаунта на конец дня, а не прибыль/убыток за день.",
        depositGuideHint: "Пример: вчера 10000, сегодня +120 → вводишь 10120.",
        futureDayLocked: "Будущие даты нельзя заполнять.",
        cancel: "Отмена",
        save: "Сохранить",
      };
    }
    if (locale === "uk") {
      return {
        monthTracker: "Трекер місяця",
        consistency: "Дисципліна",
        depositSize: "Розмір депозиту",
        tradesPerDay: "Угод / день",
        day: "День",
        type: "Тип",
        trades: "Угоди",
        deposit: "Депозит",
        disciplineScore: "DISCIPLINE SCORE",
        greenStreak: "GREEN STREAK",
        redStreak: "RED STREAK",
        mon: "Пн",
        tue: "Вт",
        wed: "Ср",
        thu: "Чт",
        fri: "Пт",
        sat: "Сб",
        sun: "Нд",
        aiAdvice: "AI порада щодо дисципліни",
        reviewMonth: "Місяць",
        reviewYear: "Рік",
        monthlyReview: "Огляд місяця",
        yearlyReview: "Огляд року",
        totalTrades: "Угод за місяць",
        avgTrades: "Угод на день (серед.)",
        greenPnlSum: "Сума PnL зелених",
        redPnlSum: "Сума PnL червоних",
        redDamageShare: "Частка втрат червоних",
        maxDrawdown: "Макс. просадка",
        totalTradesHint: "Загальна кількість відкритих угод за вибраний місяць (сума всіх угод у заповнених днях).",
        avgTradesHint: "Середня кількість угод на день: угоди за місяць / кількість заповнених днів.",
        greenPnlSumHint: "Сумарний результат системних днів (зелений і зелений з обводкою), розрахований за зміною депозиту.",
        redPnlSumHint: "Сумарний результат днів з порушенням дисципліни (червоні дні), за зміною депозиту.",
        redDamageShareHint: "Який відсоток прибутку зелених днів зʼїли збитки червоних днів. Чим менше, тим краще.",
        maxDrawdownHint: "Максимальна просадка депозиту від локального піка всередині місяця.",
        signalizer: "Сигналізатор",
        creating: "Створення...",
        shareSequence: "Поділитися серією",
        copy: "Копіювати",
        daySettings: "Налаштування дня",
        result: "Результат",
        openedTrades: "Відкрито угод (шт)",
        noPrevDay: "Попереднього дня немає, введіть депозит",
        autoFromPrev: "Авто з попереднього дня",
        enterDeposit: "Введіть суму депозиту",
        clearDay: "Очистити день",
        dayGuideTitle: "Як позначати день",
        dayGuideGreen: "Зелений — торгував за планом (PnL може бути і плюс, і мінус).",
        dayGuideRed: "Червоний — порушив правила (навіть якщо день був у плюс).",
        dayGuideOutline: "Зелений з обводкою — свідомо пропустив торгівлю за правилами.",
        depositGuideTitle: "Який депозит вводити",
        depositGuideText: "Вводь загальний баланс акаунта на кінець дня, а не прибуток/збиток за день.",
        depositGuideHint: "Приклад: вчора 10000, сьогодні +120 → вводиш 10120.",
        futureDayLocked: "Майбутні дати не можна заповнювати.",
        cancel: "Скасувати",
        save: "Зберегти",
      };
    }
    return {
      monthTracker: "Monthly Tracker",
      consistency: "Consistency",
      depositSize: "Deposit size",
      tradesPerDay: "Trades / day",
      day: "Day",
      type: "Type",
      trades: "Trades",
      deposit: "Deposit",
      disciplineScore: "DISCIPLINE SCORE",
      greenStreak: "GREEN STREAK",
      redStreak: "RED STREAK",
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
      sun: "Sun",
      aiAdvice: "AI discipline advice",
      reviewMonth: "Month",
      reviewYear: "Year",
      monthlyReview: "Monthly review",
      yearlyReview: "Yearly review",
      totalTrades: "Total trades (month)",
      avgTrades: "Avg trades/day",
      greenPnlSum: "Green PnL sum",
      redPnlSum: "Red PnL sum",
      redDamageShare: "Red Damage Share",
      maxDrawdown: "Max drawdown",
      totalTradesHint: "Total number of opened trades in the selected month (sum across all filled days).",
      avgTradesHint: "Average trades per day: monthly total trades / number of filled days.",
      greenPnlSumHint: "Combined result of disciplined days (green and outlined green), based on deposit changes.",
      redPnlSumHint: "Combined result of undisciplined days (red), based on deposit changes.",
      redDamageShareHint: "What percent of green-day profits was eaten by red-day losses. Lower is better.",
      maxDrawdownHint: "Maximum deposit drop from a local peak within the month.",
      signalizer: "Signalizer",
      creating: "Creating...",
      shareSequence: "Share sequence",
      copy: "Copy",
      daySettings: "Day settings",
      result: "Result",
      openedTrades: "Opened trades (count)",
      noPrevDay: "No previous day found, enter deposit",
      autoFromPrev: "Auto from previous day",
      enterDeposit: "Enter deposit amount",
      clearDay: "Clear day",
      dayGuideTitle: "How to mark the day",
      dayGuideGreen: "Green — you followed your plan (PnL can be positive or negative).",
      dayGuideRed: "Red — you broke your rules (even if the day ended in profit).",
      dayGuideOutline: "Green with white outline — intentional no-trade day by your rules.",
      depositGuideTitle: "What to enter as deposit",
      depositGuideText: "Enter your total account balance at end of day, not daily PnL.",
      depositGuideHint: "Example: yesterday 10000, today +120 → enter 10120.",
      futureDayLocked: "Future dates cannot be filled.",
      cancel: "Cancel",
      save: "Save",
    };
  }, [locale]);

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
          if (msg) {
            setSyncError(
              locale === "ru"
                ? `Ошибка cloud sync: ${msg}`
                : locale === "uk"
                  ? `Помилка cloud sync: ${msg}`
                  : `Cloud sync error: ${msg}`,
            );
          } else {
            setSyncError(
              locale === "ru"
                ? "Cloud sync временно недоступен."
                : locale === "uk"
                  ? "Cloud sync тимчасово недоступний."
                  : "Cloud sync is temporarily unavailable.",
            );
          }
        }
      }
    };

    loadFromServer();
    return () => {
      cancelled = true;
    };
  }, [locale, storageKey, userKey]);

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

    return { score, greenStreak, redStreak };
  }, [sortedEntries, viewMonth, viewYear]);

  const signalizer = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    const monthItems = sortedEntries
      .filter(([dateKey]) => dateKey.startsWith(monthPrefix))
      .map(([dateKey, entry]) => ({ dateKey, ...entry }));

    const t = (ru: string, uk: string, en: string) => (locale === "ru" ? ru : locale === "uk" ? uk : en);
    const items: SignalItem[] = [];
    const dedupe = new Set<string>();
    const addSignal = (key: string, level: SignalLevel, label: string, message: string) => {
      if (dedupe.has(key)) return;
      dedupe.add(key);
      items.push({ key, level, label, message });
    };

    const classifyTrend = (deltaPct: number, flatThresholdPct = 0.35) => {
      if (deltaPct > flatThresholdPct) return "up" as const;
      if (deltaPct < -flatThresholdPct) return "down" as const;
      return "flat" as const;
    };

    if (monthItems.length < 2) {
      addSignal(
        "monitoring",
        "ok",
        t("Мониторинг", "Моніторинг", "Monitoring"),
        t(
          "Нужно минимум 2 заполненных дня для обнаружения риск-паттернов.",
          "Потрібно щонайменше 2 заповнені дні для виявлення ризик-патернів.",
          "Need at least 2 filled days to detect risk patterns.",
        ),
      );
    } else {
      const dayScore = (variant: Variant) => (variant === "neg" ? -1 : 1);
      const cumulative = monthItems.reduce<number[]>((acc, day) => {
        const prev = acc.length ? acc[acc.length - 1] : 0;
        acc.push(prev + dayScore(day.variant));
        return acc;
      }, []);
      const dayDeltas = monthItems.map((day, index) => {
        if (index === 0) return 0;
        const prev = Number(monthItems[index - 1].deposit) || 0;
        const curr = Number(day.deposit) || 0;
        return curr - prev;
      });

      const latest = monthItems[monthItems.length - 1];
      const previous = monthItems[monthItems.length - 2];
      const latestDeposit = Number(latest.deposit) || 0;
      const previousDeposit = Number(previous.deposit) || 0;
      const depositDelta = latestDeposit - previousDeposit;
      const latestDelta = dayDeltas[dayDeltas.length - 1] ?? 0;
      const totalDays = monthItems.length;
      const redDays = monthItems.filter((d) => d.variant === "neg").length;
      const greenDays = monthItems.filter((d) => d.variant !== "neg").length;
      const skipDays = monthItems.filter((d) => d.variant === "pos-outline").length;
      const disciplinePct = redDays + greenDays > 0 ? (greenDays / (greenDays + redDays)) * 100 : 0;

      const firstDeposit = Number(monthItems[0].deposit) || 0;
      const bDeltaPct = firstDeposit > 0 ? ((latestDeposit - firstDeposit) / firstDeposit) * 100 : 0;
      const bTrend = classifyTrend(bDeltaPct, 0.35);

      const dWindow = Math.min(5, cumulative.length);
      const dStart = cumulative[cumulative.length - dWindow] ?? cumulative[0] ?? 0;
      const dEnd = cumulative[cumulative.length - 1] ?? 0;
      const dDelta = dEnd - dStart;
      const dTrend = dDelta > 0.5 ? "up" : dDelta < -0.5 ? "down" : "flat";

      const greenTrades = monthItems
        .filter((day) => day.variant !== "neg")
        .map((day) => Number(day.trades) || 0);
      const fallbackTrades = monthItems.map((day) => Number(day.trades) || 0);
      const baselineSource = greenTrades.length ? greenTrades : fallbackTrades;
      const baselineTrades =
        baselineSource.length > 0
          ? baselineSource.reduce((sum, trades) => sum + trades, 0) / baselineSource.length
          : 1;
      const avgTradesAll = fallbackTrades.reduce((sum, value) => sum + value, 0) / Math.max(fallbackTrades.length, 1);
      const avgTradesRed =
        monthItems.filter((d) => d.variant === "neg").reduce((sum, d) => sum + (Number(d.trades) || 0), 0) /
        Math.max(redDays, 1);
      const avgTradesGreen =
        monthItems.filter((d) => d.variant !== "neg").reduce((sum, d) => sum + (Number(d.trades) || 0), 0) /
        Math.max(greenDays, 1);
      const overtradeThreshold = baselineTrades * 1.5;
      const severeTiltThreshold = Math.max(3, Math.ceil(baselineTrades * 3));
      const lowTradesThreshold = Math.max(1, baselineTrades * 0.5);

      const recent5 = monthItems.slice(-5);
      const recent3 = monthItems.slice(-3);
      const recent3TradesHigh = recent3.length === 3 && recent3.every((d) => (Number(d.trades) || 0) > overtradeThreshold);
      const recent3DisciplineDown =
        recent3.length === 3 &&
        recent3.every((d, idx) => idx === 0 || dayScore(d.variant) < dayScore(recent3[idx - 1].variant));
      const recentRedCount = recent3.filter((day) => day.variant === "neg").length;
      const recentSkipCount = recent5.filter((day) => day.variant === "pos-outline").length;

      const greenProfitOnly = monthItems.reduce((acc, day, idx) => {
        if (idx === 0 || day.variant === "neg") return acc;
        return acc + Math.max(dayDeltas[idx] ?? 0, 0);
      }, 0);
      const redLossOnly = monthItems.reduce((acc, day, idx) => {
        if (idx === 0 || day.variant !== "neg") return acc;
        return acc + Math.abs(Math.min(dayDeltas[idx] ?? 0, 0));
      }, 0);
      const redDamageShare = greenProfitOnly > 0 ? (redLossOnly / greenProfitOnly) * 100 : 0;

      // I. Matrix B × D
      if (bTrend === "up" && dTrend === "up") {
        addSignal(
          "pro-growth",
          "ok",
          t("Рост по системе", "Ріст за системою", "Pro Growth"),
          t(
            "Депозит и дисциплина растут одновременно. Не увеличивайте риск, удерживайте текущий ритм.",
            "Депозит і дисципліна зростають одночасно. Не підвищуйте ризик, зберігайте поточний ритм.",
            "Deposit and discipline are rising together. Keep risk stable and preserve your current routine.",
          ),
        );
      }
      if (bTrend === "up" && dTrend === "down") {
        addSignal(
          "euphoria",
          "warn",
          t("Эйфория", "Ейфорія", "Euphoria"),
          t(
            "Депозит растет, но дисциплина падает. Это опасный рост: сократите риск и лимит сделок.",
            "Депозит зростає, але дисципліна падає. Це небезпечне зростання: зменште ризик і ліміт угод.",
            "Deposit is growing while discipline is dropping. This is dangerous growth: cut risk and trade count.",
          ),
        );
      }
      if (bTrend === "down" && dTrend === "up") {
        addSignal(
          "system-test",
          "ok",
          t("Тест системы", "Тест системи", "System Test"),
          t(
            "Рынок сложный, но поведение правильное. Не меняйте ТС, сохраняйте процесс.",
            "Ринок складний, але поведінка правильна. Не змінюйте ТС, зберігайте процес.",
            "Market is difficult but behavior is correct. Do not change the strategy, keep execution quality.",
          ),
        );
      }
      if (bTrend === "down" && dTrend === "down") {
        addSignal(
          "tilt-zone",
          "critical",
          t("Зона тильта", "Зона тільту", "Tilt Zone"),
          t(
            "И депозит, и дисциплина в снижении. Сделайте паузу и вернитесь с жестким лимитом на сделки.",
            "І депозит, і дисципліна знижуються. Зробіть паузу та поверніться з жорстким лімітом угод.",
            "Both deposit and discipline are falling. Pause and resume only with strict trade limits.",
          ),
        );
      }
      if (bTrend === "flat" && dTrend === "down") {
        addSignal(
          "drift",
          "warn",
          t("Дрейф поведения", "Дрейф поведінки", "Drift"),
          t(
            "Результат в боковике, а дисциплина ухудшается. Ограничьте активность и уберите лишние входы.",
            "Результат у боковику, а дисципліна погіршується. Обмежте активність і приберіть зайві входи.",
            "Results are flat but discipline is getting worse. Reduce activity and cut marginal entries.",
          ),
        );
      }
      if (bTrend === "flat" && dTrend === "up") {
        addSignal(
          "pre-breakout",
          "ok",
          t("Подготовка к росту", "Підготовка до росту", "Pre Breakout"),
          t(
            "Качество исполнения растет в боковике. Обычно это база для следующего этапа роста.",
            "Якість виконання зростає у боковику. Зазвичай це база для наступного етапу росту.",
            "Execution quality is improving during flat performance. This is often a base before growth.",
          ),
        );
      }

      const isCriticalTilt =
        latest.variant === "neg" && latest.trades >= severeTiltThreshold && depositDelta < 0;
      if (isCriticalTilt) {
        addSignal(
          "critical-tilt",
          "critical",
          t("Критический тильт", "Критичний тільт", "Critical Tilt"),
          t(
            `Красный день + ${latest.trades} сделок (выше x3 базовой нормы) + падение депозита. Остановите торговлю и сбросьте режим.`,
            `Червоний день + ${latest.trades} угод (вище x3 базової норми) + падіння депозиту. Зупиніть торгівлю та скиньте режим.`,
            `Red day + ${latest.trades} trades (above x3 baseline) + deposit drop. Stop trading and reset rules now.`,
          ),
        );
      }

      const isLuckyProfit = latest.variant === "neg" && depositDelta > 0;
      if (isLuckyProfit) {
        addSignal(
          "lucky-profit",
          "warn",
          t("Лудка в плюс", "Лудка в плюс", "Lucky Profit"),
          t(
            "Депозит вырос в красный день. Профит маскирует нарушение правил.",
            "Депозит виріс у червоному дні. Профіт маскує порушення правил.",
            "Deposit grew on a red day. Profit is masking rule-breaking behavior.",
          ),
        );
      }

      // II. Divergences
      if (recent3DisciplineDown && depositDelta >= 0) {
        addSignal(
          "pre-drawdown",
          "warn",
          t("Предпросадка", "Передпросадка", "Pre Drawdown"),
          t(
            "Дисциплина падает несколько дней подряд, пока депозит еще держится. Обычно это ранний риск просадки.",
            "Дисципліна падає кілька днів поспіль, поки депозит ще тримається. Це ранній ризик просадки.",
            "Discipline has dropped for several days while balance still holds. This often leads to drawdown soon.",
          ),
        );
      }
      if (bTrend === "up" && redDays > 0) {
        addSignal(
          "false-confidence",
          "warn",
          t("Ложная уверенность", "Хибна впевненість", "False Confidence"),
          t(
            "Есть красные дни при росте депозита. Прибыль может быть случайной и укреплять плохую привычку.",
            "Є червоні дні при зростанні депозиту. Прибуток може бути випадковим і закріплювати погану звичку.",
            "There are red days during balance growth. Profit may be random and reinforce bad habits.",
          ),
        );
      }
      if (greenProfitOnly > 0 && redLossOnly > greenProfitOnly * 0.3) {
        addSignal(
          "self-sabotage",
          "warn",
          t("Самосаботаж", "Самосаботаж", "Self Sabotage"),
          t(
            "Нарушения заметно съедают прибыль системных дней. Введите жесткий лимит сделок.",
            "Порушення помітно зʼїдають прибуток системних днів. Введіть жорсткий ліміт угод.",
            "Rule-breaking is eating a large share of system profits. Use a strict daily trade cap.",
          ),
        );
      }

      const prefix = monthItems.slice(0, Math.max(0, monthItems.length - 3));
      let longestGreenRun = 0;
      let currentGreenRun = 0;
      prefix.forEach((day) => {
        if (day.variant === "neg") {
          currentGreenRun = 0;
          return;
        }
        currentGreenRun += 1;
        if (currentGreenRun > longestGreenRun) longestGreenRun = currentGreenRun;
      });
      const isRegression = longestGreenRun >= 4 && recentRedCount >= 2;
      if (isRegression) {
        addSignal(
          "regression",
          "warn",
          t("Регрессия", "Регресія", "Regression"),
          t(
            "После длинной зеленой серии выросло число красных дней. Возьмите белый день для перезапуска.",
            "Після довгої зеленої серії зросла кількість червоних днів. Візьміть білий день для перезапуску.",
            "After a long green run, red days increased. Consider a white day for reset.",
          ),
        );
      }

      const trendWindowSize = Math.min(6, monthItems.length);
      const trendStartIndex = monthItems.length - trendWindowSize;
      const firstTrendDay = monthItems[trendStartIndex];
      const firstTrendDeposit = Number(firstTrendDay.deposit) || 0;
      const trendDepositChange = latestDeposit - firstTrendDeposit;
      const trendDisciplineChange =
        cumulative[cumulative.length - 1] - (trendStartIndex > 0 ? cumulative[trendStartIndex - 1] : 0);
      const isDivergence = trendDepositChange > 0 && trendDisciplineChange < 0;
      if (isDivergence) {
        addSignal(
          "divergence",
          "warn",
          t("Риск дивергенции", "Ризик дивергенції", "Divergence Risk"),
          t(
            "Депозит растет, а тренд дисциплины падает. Часто это перед нестабильной просадкой.",
            "Депозит зростає, а тренд дисципліни падає. Часто це перед нестабільною просадкою.",
            "Deposit is rising while discipline trend is falling. This often precedes unstable drawdowns.",
          ),
        );
      }

      // III. Day streaks
      if (longestGreenRun >= 4) {
        addSignal(
          "green-streak",
          "ok",
          t("Зеленая серия", "Зелена серія", "Green Streak"),
          t(
            "Сильная серия системных дней. Следите за эйфорией и не ускоряйтесь.",
            "Сильна серія системних днів. Слідкуйте за ейфорією та не прискорюйтесь.",
            "Strong run of disciplined days. Guard against euphoria and avoid over-acceleration.",
          ),
        );
      }
      if (recentRedCount >= 2) {
        addSignal(
          "red-streak",
          "critical",
          t("Красная серия", "Червона серія", "Red Streak"),
          t(
            "Несколько красных дней подряд — признак потери контроля. Нужна пауза и перезапуск лимитов.",
            "Кілька червоних днів поспіль — ознака втрати контролю. Потрібна пауза і перезапуск лімітів.",
            "Multiple red days in a row indicate loss of control. Pause and reset your limits.",
          ),
        );
      }
      const prevGreenRun = (() => {
        let run = 0;
        for (let i = monthItems.length - 2; i >= 0; i -= 1) {
          if (monthItems[i].variant === "neg") break;
          run += 1;
        }
        return run;
      })();
      if (latest.variant === "neg" && prevGreenRun >= 3) {
        addSignal(
          "switch-g2r",
          "warn",
          t("Слом серии", "Злам серії", "Switch G→R"),
          t(
            "После зеленой серии пришел красный день. Это типичный сбой после уверенности.",
            "Після зеленої серії прийшов червоний день. Це типовий збій після впевненості.",
            "A red day after a green streak often indicates a confidence slip.",
          ),
        );
      }
      const prevRedRun = (() => {
        let run = 0;
        for (let i = monthItems.length - 2; i >= 0; i -= 1) {
          if (monthItems[i].variant !== "neg") break;
          run += 1;
        }
        return run;
      })();
      if (latest.variant !== "neg" && prevRedRun >= 2) {
        addSignal(
          "switch-r2g",
          "ok",
          t("Возврат контроля", "Повернення контролю", "Switch R→G"),
          t(
            "После красной серии день закрыт по плану. Сохраняйте тот же темп и не ускоряйтесь.",
            "Після червоної серії день закрито за планом. Зберігайте той самий темп і не прискорюйтесь.",
            "A disciplined day after a red streak means control is returning. Keep the same pace.",
          ),
        );
      }

      // IV. Trades / day rhythm
      if (recent3TradesHigh) {
        addSignal(
          "overtrading",
          "warn",
          t("Овертрейдинг", "Овертрейдинг", "Overtrading"),
          t(
            "Три дня подряд активность выше нормы. Введите жесткий лимит сделок на день.",
            "Три дні поспіль активність вище норми. Введіть жорсткий ліміт угод на день.",
            "Activity has been above baseline for 3 straight days. Apply a strict daily trade cap.",
          ),
        );
      }
      if (latest.variant === "neg" && latest.trades > overtradeThreshold && previous.variant === "neg") {
        addSignal(
          "tilt-spike",
          "critical",
          t("Всплеск тильта", "Сплеск тільту", "Tilt Spike"),
          t(
            "После красного дня сделки резко выросли — это попытка отбиться. Нужна блокировка до следующего дня.",
            "Після червоного дня угоди різко зросли — це спроба відігратись. Потрібне блокування до наступного дня.",
            "Trade count spiked after a red day, likely revenge trading. Block trading until next day.",
          ),
        );
      }
      if (previous.variant !== "neg" && latest.trades > overtradeThreshold && latest.variant !== "neg") {
        addSignal(
          "ego-spike",
          "warn",
          t("Эго-всплеск", "Его-сплеск", "Ego Spike"),
          t(
            "После успешного дня активность выросла слишком резко. Снижайте риск и держите темп.",
            "Після успішного дня активність зросла занадто різко. Знижуйте ризик і тримайте темп.",
            "Activity jumped too hard after a good day. Reduce risk and return to baseline pace.",
          ),
        );
      }
      if (bTrend === "down" && (latest.trades || 0) < lowTradesThreshold) {
        addSignal(
          "freeze",
          "warn",
          t("Фриз", "Фриз", "Freeze"),
          t(
            "Депозит снижается при слишком низкой активности. Вернитесь к базовому ритму и минимальному риску.",
            "Депозит знижується при занадто низькій активності. Поверніться до базового ритму і мінімального ризику.",
            "Balance is falling while activity is too low. Return to your base routine with minimal risk.",
          ),
        );
      }

      // V. Skip-day logic (pos-outline)
      if (skipDays >= 2 && dTrend === "up") {
        addSignal(
          "smart-filter",
          "ok",
          t("Умная фильтрация", "Розумна фільтрація", "Smart Filter"),
          t(
            "Пропуски рынка помогают сохранять дисциплину. Это признак качественного отбора сетапов.",
            "Пропуски ринку допомагають зберігати дисципліну. Це ознака якісного відбору сетапів.",
            "No-trade days are supporting discipline. This is a sign of quality setup filtering.",
          ),
        );
      }
      if (recentSkipCount >= 2 && dTrend === "down" && bTrend === "down") {
        addSignal(
          "avoidance",
          "warn",
          t("Избегание", "Уникання", "Avoidance"),
          t(
            "Много пропусков на фоне падения дисциплины и депозита. Похоже на уход от решений, а не фильтрацию.",
            "Багато пропусків на фоні падіння дисципліни й депозиту. Це більше схоже на уникання, а не фільтрацію.",
            "Many skip days with falling discipline and balance suggest avoidance, not smart filtering.",
          ),
        );
      }
      if (recentSkipCount >= 2 && latest.trades > overtradeThreshold && latest.variant === "neg") {
        addSignal(
          "fomo-return",
          "warn",
          t("FOMO-возврат", "FOMO-повернення", "FOMO Return"),
          t(
            "После пропусков произошел эмоциональный возврат с высоким числом сделок. Ограничьте активность.",
            "Після пропусків стався емоційний повернення з високою кількістю угод. Обмежте активність.",
            "After skip days, trading returned with emotional overactivity. Cap trade count immediately.",
          ),
        );
      }

      // VI. Day × result
      if (latest.variant !== "neg" && latestDelta < 0) {
        addSignal(
          "disciplined-loss",
          "ok",
          t("Системный минус", "Системний мінус", "Disciplined Loss"),
          t(
            "Убыточный, но дисциплинированный день — нормальная часть системы.",
            "Збитковий, але дисциплінований день — нормальна частина системи.",
            "A losing but disciplined day is a normal part of a robust strategy.",
          ),
        );
      }
      if (latest.variant === "neg" && latestDelta > 0) {
        addSignal(
          "chaotic-win",
          "warn",
          t("Хаотичный плюс", "Хаотичний плюс", "Chaotic Win"),
          t(
            "Профит в красный день — опасное подкрепление плохой привычки.",
            "Профіт у червоний день — небезпечне підкріплення поганої звички.",
            "Profit on a red day reinforces bad behavior. Treat it as a warning, not success.",
          ),
        );
      }
      if (latest.variant === "neg" && latestDelta < 0) {
        addSignal(
          "chaotic-loss",
          "critical",
          t("Хаотичный минус", "Хаотичний мінус", "Chaotic Loss"),
          t(
            "Нарушение дисциплины и убыток в одном дне. Нужен немедленный откат к базовым лимитам.",
            "Порушення дисципліни та збиток в одному дні. Потрібен негайний відкат до базових лімітів.",
            "Rule-breaking and loss in one day. Immediately reset to strict baseline limits.",
          ),
        );
      }

      // VII. Critical thresholds
      if (disciplinePct < 60) {
        addSignal(
          "discipline-crisis",
          "critical",
          t("Кризис дисциплины", "Криза дисципліни", "Discipline Crisis"),
          t(
            "Дисциплина ниже 60%. Торгуйте только в ограниченном режиме до восстановления показателя.",
            "Дисципліна нижче 60%. Торгуйте лише в обмеженому режимі до відновлення показника.",
            "Discipline is below 60%. Use restricted mode until the metric recovers.",
          ),
        );
      }
      if (redDamageShare > 50) {
        addSignal(
          "red-cost",
          "warn",
          t("Высокая цена красных дней", "Висока ціна червоних днів", "High Red-Day Cost"),
          t(
            "Красные дни съедают более 50% прибыли зеленых. Снижайте риск и частоту.",
            "Червоні дні зʼїдають понад 50% прибутку зелених. Знижуйте ризик і частоту.",
            "Red days are eating more than 50% of green-day profits. Reduce risk and frequency.",
          ),
        );
      }
      if (avgTradesRed > avgTradesGreen && redDays >= 2 && greenDays >= 2) {
        addSignal(
          "trade-imbalance",
          "warn",
          t("Дисбаланс сделок", "Дисбаланс угод", "Trade Imbalance"),
          t(
            "В красные дни сделок больше, чем в зеленые. Это признак эмоционального давления.",
            "У червоні дні угод більше, ніж у зелені. Це ознака емоційного тиску.",
            "You trade more on red days than green days. This is an emotional-pressure pattern.",
          ),
        );
      }

      // VIII. Ideal patterns
      if (avgTradesAll <= 2 && disciplinePct >= 80 && bTrend !== "down") {
        addSignal(
          "low-t-high-d",
          "ok",
          t("Проф-режим", "Проф-режим", "Low T / High D"),
          t(
            "Низкая частота при высокой дисциплине. Профиль близок к профессиональному режиму.",
            "Низька частота при високій дисципліні. Профіль близький до професійного режиму.",
            "Low frequency with high discipline. This profile is close to pro execution mode.",
          ),
        );
      }
      const tradeVariance = (() => {
        const m = avgTradesAll;
        const variance = fallbackTrades.reduce((acc, value) => acc + (value - m) ** 2, 0) / Math.max(fallbackTrades.length, 1);
        return Math.sqrt(variance);
      })();
      if (tradeVariance <= 1.2 && disciplinePct >= 70 && bTrend === "up") {
        addSignal(
          "stable-rhythm",
          "ok",
          t("Стабильный ритм", "Стабільний ритм", "Stable Rhythm"),
          t(
            "Частота сделок и дисциплина стабильны, депозит растет. Это оптимальный рабочий цикл.",
            "Частота угод і дисципліна стабільні, депозит зростає. Це оптимальний робочий цикл.",
            "Trade cadence and discipline are stable while balance is rising. This is an optimal cycle.",
          ),
        );
      }

      if (!items.length) {
        addSignal(
          "healthy",
          "ok",
          t("Стабильное состояние", "Стабільний стан", "Healthy State"),
          t(
            "Критичных риск-паттернов не обнаружено. Держите стабильное качество исполнения.",
            "Критичних ризик-патернів не виявлено. Тримайте стабільну якість виконання.",
            "No critical risk pattern detected. Keep execution quality and trade frequency stable.",
          ),
        );
      }
    }

    const byPriority = { critical: 0, warn: 1, ok: 2 } as const;
    items.sort((a, b) => byPriority[a.level] - byPriority[b.level]);
    const visibleItems = items.slice(0, 8);

    const summaryLevel: SignalLevel = visibleItems.some((item) => item.level === "critical")
      ? "critical"
      : visibleItems.some((item) => item.level === "warn")
        ? "warn"
        : "ok";
    const summaryTitle =
      summaryLevel === "critical"
        ? locale === "ru"
          ? "Высокий риск"
          : locale === "uk"
            ? "Високий ризик"
            : "High risk detected"
        : summaryLevel === "warn"
          ? locale === "ru"
            ? "Риск-сигнал активен"
            : locale === "uk"
              ? "Ризик-сигнал активний"
              : "Risk signal active"
          : locale === "ru"
            ? "Система стабильна"
            : locale === "uk"
              ? "Система стабільна"
              : "System stable";
    const summaryMessage =
      summaryLevel === "critical"
        ? locale === "ru"
          ? "Сейчас риск исполнения повышен. Снизьте активность и вернитесь к жестким лимитам."
          : locale === "uk"
            ? "Зараз ризик виконання підвищений. Зменшіть активність і поверніться до жорстких лімітів."
            : "Execution risk is elevated right now. Reduce activity and follow strict limits."
        : summaryLevel === "warn"
          ? locale === "ru"
            ? "Обнаружен поведенческий сдвиг. Исправьте сейчас, пока он не накопился."
            : locale === "uk"
              ? "Виявлено поведінкове відхилення. Виправте зараз, поки не накопичилось."
              : "Behavioral drift detected. Correct now before it compounds."
          : locale === "ru"
            ? "Профиль исполнения в этом месяце стабилен."
            : locale === "uk"
              ? "Профіль виконання цього місяця стабільний."
              : "Execution profile is stable this month.";

    return { summaryLevel, summaryTitle, summaryMessage, items: visibleItems };
  }, [locale, sortedEntries, viewMonth, viewYear]);

  const monthFilledCount = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    return sortedEntries.filter(([dateKey]) => dateKey.startsWith(monthPrefix)).length;
  }, [sortedEntries, viewMonth, viewYear]);

  const aiLiveAdvice = useMemo(() => {
    const summaryAction =
      signalizer.summaryLevel === "critical"
        ? locale === "ru"
          ? "Снизьте активность сразу: только базовые сетапы и лимит сделок."
          : locale === "uk"
            ? "Знизьте активність одразу: лише базові сетапи та ліміт угод."
            : "Reduce activity immediately: only core setups and a hard trades cap."
        : signalizer.summaryLevel === "warn"
          ? locale === "ru"
            ? "Сохраните режим контроля: фиксируйте риск до начала сессии."
            : locale === "uk"
              ? "Збережіть режим контролю: фіксуйте ризик до початку сесії."
              : "Keep control mode: lock risk limits before the session starts."
          : locale === "ru"
            ? "Режим стабильный: продолжайте в том же ритме без разгона."
            : locale === "uk"
              ? "Режим стабільний: продовжуйте в тому ж ритмі без розгону."
              : "Execution is stable: keep the same pace without acceleration.";

    const topSignals = signalizer.items.slice(0, 2).map((item) => item.message);
    const lead =
      locale === "ru"
        ? "Совет на основе последних поведенческих факторов."
        : locale === "uk"
          ? "Порада на основі останніх поведінкових факторів."
          : "Advice based on recent behavioral factors.";
    const tail =
      locale === "ru"
        ? "Следующее обновление будет после 3 новых заполненных дней."
        : locale === "uk"
          ? "Наступне оновлення буде після 3 нових заповнених днів."
          : "Next update will be after 3 new filled days.";

    if (!topSignals.length) {
      return `${lead} ${summaryAction} ${tail}`;
    }
    return `${lead} ${topSignals.join(" ")} ${summaryAction} ${tail}`;
  }, [locale, signalizer.items, signalizer.summaryLevel]);

  useEffect(() => {
    const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    const next =
      !adviceSnapshot ||
      adviceSnapshot.monthKey !== monthKey ||
      monthFilledCount < adviceSnapshot.lastCount ||
      monthFilledCount - adviceSnapshot.lastCount >= 3 ||
      !adviceSnapshot.advice
        ? {
            monthKey,
            lastCount: monthFilledCount,
            advice: aiLiveAdvice,
          }
        : adviceSnapshot;

    if (
      !adviceSnapshot ||
      adviceSnapshot.monthKey !== next.monthKey ||
      adviceSnapshot.lastCount !== next.lastCount ||
      adviceSnapshot.advice !== next.advice
    ) {
      setAdviceSnapshot(next);
      try {
        localStorage.setItem(`jour-ai-advice-${userKey}`, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
    }
  }, [adviceSnapshot, aiLiveAdvice, monthFilledCount, userKey, viewMonth, viewYear]);

  const periodReview = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    const yearPrefix = `${viewYear}-`;
    const periodItems = sortedEntries
      .filter(([dateKey]) => (reviewMode === "month" ? dateKey.startsWith(monthPrefix) : dateKey.startsWith(yearPrefix)))
      .map(([dateKey, entry]) => ({ dateKey, ...entry }));
    const values = periodItems;

    const formatSignedUsd = (value: number) => {
      const sign = value >= 0 ? "+" : "-";
      const rounded = Math.round(Math.abs(value));
      return `${sign}${rounded.toLocaleString(locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US")}$`;
    };

    if (!values.length) {
      return {
        totalTrades: "0",
        avgTrades: "0.0",
        greenPnlSum: "0$",
        redPnlSum: "0$",
        redDamageShare: "0%",
        maxDrawdown: "0.0%",
      };
    }

    const totalTradesCount = values.reduce((acc, day) => acc + (Number(day.trades) || 0), 0);
    const avgTrades = (totalTradesCount / values.length).toFixed(1);

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
      if (index === 0) return { day: day.dateKey, delta: 0, variant: day.variant };
      const prev = Number(values[index - 1].deposit) || 0;
      const curr = Number(day.deposit) || 0;
      return { day: day.dateKey, delta: curr - prev, variant: day.variant };
    });

    const greenPnl = deltas
      .filter((day) => day.variant === "pos" || day.variant === "pos-outline")
      .reduce((acc, day) => acc + day.delta, 0);
    const redPnl = deltas.filter((day) => day.variant === "neg").reduce((acc, day) => acc + day.delta, 0);

    const greenProfitOnly = deltas
      .filter((day) => day.variant === "pos" || day.variant === "pos-outline")
      .reduce((acc, day) => acc + Math.max(day.delta, 0), 0);
    const redLossOnly = deltas
      .filter((day) => day.variant === "neg")
      .reduce((acc, day) => acc + Math.abs(Math.min(day.delta, 0)), 0);
    const redDamageShare = greenProfitOnly > 0 ? `${((redLossOnly / greenProfitOnly) * 100).toFixed(1)}%` : "0%";

    return {
      totalTrades: `${totalTradesCount}`,
      avgTrades,
      greenPnlSum: formatSignedUsd(greenPnl),
      redPnlSum: formatSignedUsd(redPnl),
      redDamageShare,
      maxDrawdown: `${maxDrawdownPct.toFixed(1)}%`,
    };
  }, [locale, reviewMode, sortedEntries, viewMonth, viewYear]);

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
    const normalizeFromBaseline = (values: number[], padding = 0) => {
      if (!values.length) return [];
      const base = values[0];
      const deltas = values.map((value) => value - base);
      const maxAbs = Math.max(1, ...deltas.map((delta) => Math.abs(delta)));
      const halfRange = 38;
      const scale = maxAbs * (1 + padding);
      return deltas.map((delta) => CENTER + (delta / scale) * halfRange);
    };
    const normalizeToAxis = (values: number[], min: number, max: number) => {
      if (!values.length) return [];
      if (max === min) return values.map(() => CENTER);
      return values.map((value) => ((value - min) / (max - min)) * 100);
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
    const fitWithAnchor = (values: number[], anchor: number, min = 2, max = 98) => {
      if (!values.length) return values;
      const low = Math.min(...values);
      const high = Math.max(...values);
      if (low >= min && high <= max) return values;
      const up = Math.max(0, high - anchor);
      const down = Math.max(0, anchor - low);
      const upCapacity = Math.max(1e-6, max - anchor);
      const downCapacity = Math.max(1e-6, anchor - min);
      const scale = Math.max(1, up / upCapacity, down / downCapacity);
      return values.map((value) => anchor + (value - anchor) / scale);
    };

    const depositRange = Math.max(1, maxDeposit - minDeposit);
    const depositPad = depositRange * 0.08;
    const displayMinDeposit = minDeposit - depositPad;
    const displayMaxDeposit = maxDeposit + depositPad;
    const normalizedDeposit = normalizeToAxis(depositValues, displayMinDeposit, displayMaxDeposit);
    const normalizedResultRaw = normalizeFromBaseline(resultValues, 0.1);
    const normalizedResultBase = limitLocalSlope(normalizedResultRaw, 14);
    const startDelta =
      normalizedDeposit.length && normalizedResultBase.length
        ? normalizedDeposit[0] - normalizedResultBase[0]
        : 0;
    const normalizedResultShifted = normalizedResultBase.map((value) => value + startDelta);
    const normalizedResult = fitWithAnchor(
      normalizedResultShifted,
      normalizedDeposit[0] ?? normalizedResultShifted[0] ?? CENTER
    );

    const steps = visible.length > 1 ? visible.length - 1 : 1;
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    const tradeMaxHeight = Math.min(height, TRADE_BAR_UNIT * TRADE_BAR_CAP);
    const barWidth = Math.max(4, Math.min(12, width / Math.max(visible.length * 1.8, 1)));
    const bars = visible.map((v, index) => {
      const centerX = bounds.left + barWidth / 2 + ((width - barWidth) * index) / steps;
      const x = centerX - barWidth / 2;
      const cappedTrades = Math.max(0, Math.min(v.trades, TRADE_BAR_CAP));
      const h = cappedTrades === 0 ? 3 : Math.min(cappedTrades * TRADE_BAR_UNIT, tradeMaxHeight);
      const y = bounds.bottom - h;
      const kind: "zero" | "ok" | "warn" | "hot" =
        v.trades === 0 ? "zero" : v.trades <= 2 ? "ok" : v.trades <= 4 ? "warn" : "hot";
      return { x, y, w: barWidth, h, kind, day: v.day, deposit: v.deposit, trades: v.trades, variant: v.variant };
    });

    const ticks = visible.map((v, index) => {
      // Keep day labels strictly centered under bars.
      const x = bounds.left + barWidth / 2 + ((width - barWidth) * index) / steps;
      return { x, label: String(v.day) };
    });

    const yTicksLeft = Array.from({ length: 5 }, (_, i) => {
      const y = bounds.bottom - (height * i) / 4;
      const ratio = i / 4;
      const depositAtY = displayMinDeposit + (displayMaxDeposit - displayMinDeposit) * ratio;
      const numberLocale = locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US";
      return { y, label: Math.round(depositAtY).toLocaleString(numberLocale) };
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
  }, [locale, sortedEntries, viewMonth, viewYear]);

  const variantLabel = (variant: Variant | "none") => {
    if (variant === "neg") return locale === "ru" ? "Красный день (-1)" : locale === "uk" ? "Червоний день (-1)" : "Red day (-1)";
    if (variant === "pos") return locale === "ru" ? "Зеленый день (+1)" : locale === "uk" ? "Зелений день (+1)" : "Green day (+1)";
    if (variant === "pos-outline") {
      return locale === "ru" ? "Зеленый контур (+1)" : locale === "uk" ? "Зелений контур (+1)" : "Green outline (+1)";
    }
    return locale === "ru" ? "Тип не выбран" : locale === "uk" ? "Тип не обрано" : "No day type";
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

  const todayKey = useMemo(() => {
    const nowDate = new Date();
    return formatDateKey(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  }, []);

  const isFutureDateKey = (dateKey: string) => dateKey > todayKey;

  const openModal = (dateKey: string) => {
    if (isFutureDateKey(dateKey)) {
      setSyncError(ui.futureDayLocked);
      return;
    }
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
    if (isFutureDateKey(selectedDateKey)) {
      setModalError(ui.futureDayLocked);
      return;
    }
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
        setModalError(
          locale === "ru"
            ? "Выберите тип дня, заполните депозит и количество сделок."
            : locale === "uk"
              ? "Оберіть тип дня, заповніть депозит і кількість угод."
              : "Choose day type, enter deposit and trades count.",
        );
      } else if (!hasVariant) {
        setModalError(locale === "ru" ? "Выберите тип дня." : locale === "uk" ? "Оберіть тип дня." : "Choose day type.");
      } else if (!hasDeposit) {
        setModalError(
          locale === "ru"
            ? "Введите депозит больше 0."
            : locale === "uk"
              ? "Введіть депозит більше 0."
              : "Enter deposit amount greater than 0.",
        );
      } else {
        setModalError(
          isOutline
            ? locale === "ru"
              ? "Для дня с белой обводкой сделки могут быть 0 и более."
              : locale === "uk"
                ? "Для дня з білою обводкою угоди можуть бути 0 і більше."
                : "For outlined green day, trades can be 0 or more."
            : locale === "ru"
              ? "Введите количество сделок больше 0."
              : locale === "uk"
                ? "Введіть кількість угод більше 0."
                : "Enter trades count greater than 0.",
        );
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
      setSyncError(
        locale === "ru"
          ? "Сохранено локально, но cloud sync не удался. Повторите попытку."
          : locale === "uk"
            ? "Збережено локально, але cloud sync не вдався. Спробуйте ще раз."
            : "Saved locally, but cloud sync failed. Try again.",
      );
    }
  };

  const clearDay = async () => {
    if (!selectedDateKey) return;
    if (isFutureDateKey(selectedDateKey)) {
      setModalError(ui.futureDayLocked);
      return;
    }

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
      setSyncError(
        locale === "ru"
          ? "Удалено локально, но cloud sync не удался. Повторите попытку."
          : locale === "uk"
            ? "Видалено локально, але cloud sync не вдався. Спробуйте ще раз."
            : "Cleared locally, but cloud sync failed. Try again.",
      );
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
      | { kind: "day"; day: number; dateKey: string; entry?: Entry; isSelected: boolean; isFuture: boolean }
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
          isFuture: dateKey > todayKey,
        });
      }
    }

    return cells;
  }, [viewMonth, viewYear, dayData, selectedDateKey, todayKey]);

  const monthLabel = useMemo(() => {
    const date = new Date(viewYear, viewMonth, 1);
    const title = date.toLocaleDateString(
      locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US",
      { month: "long", year: "numeric" },
    );
    return title.charAt(0).toUpperCase() + title.slice(1);
  }, [locale, viewMonth, viewYear]);

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
          setShareStatus(locale === "ru" ? "Скопировано. Поделитесь ссылкой." : locale === "uk" ? "Скопійовано. Поділіться посиланням." : "Copied. Share it anywhere.");
        } else {
          setShareStatus(locale === "ru" ? "Ссылка готова. Скопируйте ниже." : locale === "uk" ? "Посилання готове. Скопіюйте нижче." : "Link ready. Copy manually below.");
        }
      } catch {
        setShareStatus(locale === "ru" ? "Ссылка готова. Скопируйте ниже." : locale === "uk" ? "Посилання готове. Скопіюйте нижче." : "Link ready. Copy manually below.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : locale === "ru" ? "Неизвестная ошибка" : locale === "uk" ? "Невідома помилка" : "Unknown error";
      setShareStatus(`${locale === "ru" ? "Ошибка" : locale === "uk" ? "Помилка" : "Error"}: ${message}`);
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareLink);
        setShareStatus(locale === "ru" ? "Скопировано. Поделитесь ссылкой." : locale === "uk" ? "Скопійовано. Поділіться посиланням." : "Copied. Share it anywhere.");
        setCopyFlash(true);
        window.setTimeout(() => setCopyFlash(false), 700);
      }
    } catch {
      setShareStatus(locale === "ru" ? "Автокопирование не удалось. Скопируйте вручную." : locale === "uk" ? "Автокопіювання не вдалося. Скопіюйте вручну." : "Auto-copy failed. Copy it manually.");
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
            <h2>{ui.monthTracker}</h2>
            {syncError ? <p className={styles.syncError}>{syncError}</p> : null}
          </div>

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <i className={`${styles.legendLine} ${styles.legendYellow}`} /> {ui.consistency}
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendLine} ${styles.legendBlue}`} /> {ui.depositSize}
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendBar} ${styles.legendBarTrades}`} /> {ui.tradesPerDay}
            </span>
          </div>

          <div className={styles.chartWrap}>
            <svg
              className={styles.chart}
              viewBox="0 0 520 280"
              preserveAspectRatio="none"
              aria-label={ui.monthTracker}
              onMouseLeave={() => setChartHover(null)}
            >
              <defs>
                <clipPath id={chartClipId}>
                  <rect
                    x={chartModel.bounds.left}
                    y={chartModel.bounds.top}
                    width={chartModel.bounds.right - chartModel.bounds.left}
                    height={chartModel.bounds.bottom - chartModel.bounds.top}
                  />
                </clipPath>
              </defs>
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
              <g clipPath={`url(#${chartClipId})`}>
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
              <g clipPath={`url(#${chartClipId})`}>
                <path className={styles.yellowGlow} d={chartModel.yellow} />
                <path className={styles.blueGlow} d={chartModel.blue} />
                <path className={`${styles.line} ${styles.yellow}`} d={chartModel.yellow} />
                <path className={`${styles.line} ${styles.blue}`} d={chartModel.blue} />
              </g>
              {chartModel.ticks.map((tick, index) => (
                <text key={`tick-${index}`} className={styles.tickLabel} x={tick.x} y={244} textAnchor="middle">
                  {tick.label}
                </text>
              ))}
            </svg>
            {chartHover ? (
              <div className={styles.chartTooltip} style={{ left: `${chartHover.x}px`, top: `${chartHover.y}px` }}>
                <div>{ui.day}: {chartHover.day}</div>
                <div>{ui.type}: {variantLabel(chartHover.variant)}</div>
                <div>{ui.trades}: {chartHover.trades}</div>
                <div>{ui.deposit}: {Math.round(chartHover.deposit)}</div>
              </div>
            ) : null}
          </div>

          <div className={styles.scoreRow}>
            <div className={`${styles.score} ${styles.scoreBlue}`}>
              <span>{ui.disciplineScore}</span>
              <strong>{stats.score}%</strong>
            </div>
            <div className={`${styles.score} ${styles.scoreGreen}`}>
              <span>{ui.greenStreak}</span>
              <strong>{stats.greenStreak}</strong>
            </div>
            <div className={`${styles.score} ${styles.scoreRed}`}>
              <span>{ui.redStreak}</span>
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
              <h3>{monthLabel}</h3>
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
              <span>{ui.mon}</span>
              <span>{ui.tue}</span>
              <span>{ui.wed}</span>
              <span>{ui.thu}</span>
              <span>{ui.fri}</span>
              <span>{ui.sat}</span>
              <span>{ui.sun}</span>
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
                    className={`${renderDayClass(cell.entry, cell.isSelected)} ${cell.isFuture ? styles.dayLocked : ""}`}
                    onClick={() => openModal(cell.dateKey)}
                    disabled={cell.isFuture}
                    aria-disabled={cell.isFuture}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`${styles.panel} ${styles.ai}`}>
            <h4>
              <Image className={styles.aiIcon} src="/Group.svg" alt="" aria-hidden width={28} height={28} /> {ui.aiAdvice}
            </h4>
            <p>{adviceSnapshot?.advice || aiLiveAdvice}</p>
          </div>

        </div>
      </div>

      <div className={styles.monthlyRow}>
        <div
          className={`${styles.panel} ${styles.signalizer} ${
            signalizer.summaryLevel === "critical"
              ? styles.signalCritical
              : signalizer.summaryLevel === "warn"
                ? styles.signalWarn
                : styles.signalOk
          }`}
        >
          <h4>{ui.signalizer}</h4>
          <p className={styles.signalSummary}>
            <strong>{signalizer.summaryTitle}.</strong> {signalizer.summaryMessage}
          </p>
          <div className={styles.signalList}>
            {signalizer.items.slice(0, 4).map((item) => (
              <div key={item.key} className={styles.signalItem}>
                <span
                  className={`${styles.signalBadge} ${
                    item.level === "critical"
                      ? styles.signalBadgeCritical
                      : item.level === "warn"
                        ? styles.signalBadgeWarn
                        : styles.signalBadgeOk
                  }`}
                >
                  {item.level === "critical" ? "ALERT" : item.level === "warn" ? "WARN" : "OK"}
                </span>
                <div className={styles.signalText}>
                  <strong>{item.label}</strong>
                  <p>{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={`${styles.panel} ${styles.weekly}`}>
          <div className={styles.reviewHeader}>
            <h4>{reviewMode === "month" ? ui.monthlyReview : ui.yearlyReview}</h4>
            <div className={styles.reviewToggle} role="tablist" aria-label="Review mode">
              <button
                type="button"
                role="tab"
                aria-selected={reviewMode === "month"}
                className={`${styles.reviewToggleBtn} ${reviewMode === "month" ? styles.reviewToggleBtnActive : ""}`}
                onClick={() => setReviewMode("month")}
              >
                {ui.reviewMonth}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={reviewMode === "year"}
                className={`${styles.reviewToggleBtn} ${reviewMode === "year" ? styles.reviewToggleBtnActive : ""}`}
                onClick={() => setReviewMode("year")}
              >
                {ui.reviewYear}
              </button>
            </div>
          </div>
          <div className={styles.weeklyGrid}>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.totalTrades}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.totalTradesHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.totalTradesHint}</span>
                </span>
              </div>
              <strong>{periodReview.totalTrades}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.avgTrades}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.avgTradesHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.avgTradesHint}</span>
                </span>
              </div>
              <strong>{periodReview.avgTrades}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.greenPnlSum}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.greenPnlSumHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.greenPnlSumHint}</span>
                </span>
              </div>
              <strong>{periodReview.greenPnlSum}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.redPnlSum}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.redPnlSumHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.redPnlSumHint}</span>
                </span>
              </div>
              <strong>{periodReview.redPnlSum}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.redDamageShare}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.redDamageShareHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.redDamageShareHint}</span>
                </span>
              </div>
              <strong>{periodReview.redDamageShare}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.maxDrawdown}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.maxDrawdownHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.maxDrawdownHint}</span>
                </span>
              </div>
              <strong>{periodReview.maxDrawdown}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.shareRow}>
        <div />
        <div className={styles.shareBar}>
          <div className={styles.shareInline}>
            <button className={`btn primary ${styles.shareBtn}`} type="button" onClick={createShare} disabled={shareLoading}>
              {shareLoading ? ui.creating : ui.shareSequence}
            </button>
            <span className={styles.shareStatus}>{shareStatus}</span>
          </div>
          {shareLink ? (
            <div className={styles.shareManualRow}>
              <input className={styles.shareInput} type="text" value={shareLink} readOnly onFocus={(e) => e.currentTarget.select()} />
              <button className={`btn ${copyFlash ? styles.copyOk : ""}`} type="button" onClick={copyShareLink}>
                {ui.copy}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {modalOpen ? (
        <div className={styles.modalBackdrop} onClick={closeModal} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{ui.daySettings}</h3>
            <p className={styles.modalDate}>{selectedDateKey}</p>

            <label className={styles.field}>
              <div className={styles.fieldHeader}>
                <span>{ui.result}</span>
                <details className={styles.inlineHelp}>
                  <summary aria-label={ui.dayGuideTitle}>?</summary>
                  <div className={styles.inlineHelpBody}>
                    <p className={styles.inlineHelpTitle}>{ui.dayGuideTitle}</p>
                    <ul className={styles.inlineHelpList}>
                      <li>{ui.dayGuideGreen}</li>
                      <li>{ui.dayGuideRed}</li>
                      <li>{ui.dayGuideOutline}</li>
                    </ul>
                  </div>
                </details>
              </div>
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
              <div className={styles.fieldHeader}>
                <span>{ui.depositSize}</span>
                <details className={styles.inlineHelp}>
                  <summary aria-label={ui.depositGuideTitle}>?</summary>
                  <div className={styles.inlineHelpBody}>
                    <p className={styles.inlineHelpTitle}>{ui.depositGuideTitle}</p>
                    <p className={styles.inlineHelpText}>{ui.depositGuideText}</p>
                    <p className={styles.inlineHelpExample}>{ui.depositGuideHint}</p>
                  </div>
                </details>
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={
                  modalVariant === "pos-outline"
                    ? outlineNeedsManualDeposit
                      ? ui.noPrevDay
                      : ui.autoFromPrev
                    : ui.enterDeposit
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
              <span>{ui.openedTrades}</span>
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
                {ui.clearDay}
              </button>
              <div className={styles.actionsRight}>
                <button className="btn" type="button" onClick={closeModal}>
                  {ui.cancel}
                </button>
                <button className="btn primary" type="button" onClick={saveDay}>
                  {ui.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
