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
  key: "critical-tilt" | "lucky-profit" | "regression" | "divergence" | "healthy";
  level: SignalLevel;
  label: string;
  message: string;
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
  const [syncError, setSyncError] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [copyFlash, setCopyFlash] = useState(false);
  const [chartHover, setChartHover] = useState<ChartHover | null>(null);
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
        monthlyReview: "Обзор месяца",
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
        monthlyReview: "Огляд місяця",
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
      monthlyReview: "Monthly review",
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

    let advice =
      locale === "ru"
        ? "Отметьте минимум 5 дней для надежной рекомендации. Заполняйте дни последовательно. Указывайте и результат, и депозит для точности."
        : locale === "uk"
          ? "Заповніть мінімум 5 днів для надійної рекомендації. Ведіть записи послідовно. Вказуйте і результат, і депозит для точності."
          : "Track at least 5 days to unlock a reliable recommendation. Keep entries consistent for a clearer pattern. Fill both result and deposit to improve accuracy.";
    if (total >= 5) {
      if (score >= 75 && greenStreak >= 4) {
        advice =
          locale === "ru"
            ? "Сильная стабильность. Сохраняйте тот же ритм и защищайте серию, ограничивая импульсивные входы. Держите одинаковый риск на сделку и повторяйте рабочие сетапы."
            : locale === "uk"
              ? "Сильна стабільність. Зберігайте той самий ритм і захищайте серію, обмежуючи імпульсивні входи. Тримайте однаковий ризик на угоду і повторюйте робочі сетапи."
              : "Strong consistency. Keep the same routine and protect your streak by limiting impulsive entries. Use the same risk per trade to avoid variance spikes. Review only your best setups and repeat what already works.";
      } else if (redStreak >= 3) {
        advice =
          locale === "ru"
            ? "Красная серия растет. Снизьте размер позиции в ближайших сессиях и торгуйте только A+ сетапы. Сделайте паузу после двух подряд убыточных дней."
            : locale === "uk"
              ? "Червона серія зростає. Зменште розмір позиції у найближчих сесіях і торгуйте лише A+ сетапи. Зробіть паузу після двох поспіль збиткових днів."
              : "Red streak is growing. Reduce position size for the next sessions and trade only A+ setups. Pause after two consecutive losses to reset execution quality. Focus on one pattern and skip marginal entries this week.";
      } else if (score >= 60) {
        advice =
          locale === "ru"
            ? "Прогресс стабильный. Избегайте эмоциональных дней, которые ломают импульс. Фиксируйте лимит сделок до начала сессии."
            : locale === "uk"
              ? "Прогрес стабільний. Уникайте емоційних днів, які ламають імпульс. Фіксуйте ліміт угод до початку сесії."
              : "Progress is stable. Focus on avoiding single emotional days that break momentum. Lock your max trades limit before the session starts. Keep a brief post-trade note to catch repeated mistakes early.";
      } else {
        advice =
          locale === "ru"
            ? "Дисциплина нестабильна. Используйте строгий чеклист и лимит риска, пока показатель не восстановится. Снизьте частоту и верните фокус на качество."
            : locale === "uk"
              ? "Дисципліна нестабільна. Використовуйте строгий чеклист і ліміт ризику, поки показник не відновиться. Зменшіть частоту і поверніть фокус на якість."
              : "Discipline is unstable. Use a strict daily checklist and cap risk until score recovers. Reduce frequency and prioritize quality over activity. Aim for three clean sessions in a row before increasing risk.";
      }
    }

    return { score, greenStreak, redStreak, advice };
  }, [locale, sortedEntries, viewMonth, viewYear]);

  const signalizer = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    const monthItems = sortedEntries
      .filter(([dateKey]) => dateKey.startsWith(monthPrefix))
      .map(([dateKey, entry]) => ({ dateKey, ...entry }));

    const items: SignalItem[] = [];
    if (monthItems.length < 2) {
      items.push({
        key: "healthy",
        level: "ok",
        label: locale === "ru" ? "Мониторинг" : locale === "uk" ? "Моніторинг" : "Monitoring",
        message:
          locale === "ru"
            ? "Нужно минимум 2 заполненных дня для обнаружения риск-паттернов."
            : locale === "uk"
              ? "Потрібно щонайменше 2 заповнені дні для виявлення ризик-патернів."
              : "Need at least 2 filled days to detect risk patterns.",
      });
    } else {
      const dayScore = (variant: Variant) => (variant === "neg" ? -1 : variant === "pos-outline" ? 0.5 : 1);
      const cumulative = monthItems.reduce<number[]>((acc, day) => {
        const prev = acc.length ? acc[acc.length - 1] : 0;
        acc.push(prev + dayScore(day.variant));
        return acc;
      }, []);

      const latest = monthItems[monthItems.length - 1];
      const previous = monthItems[monthItems.length - 2];
      const latestDeposit = Number(latest.deposit) || 0;
      const previousDeposit = Number(previous.deposit) || 0;
      const depositDelta = latestDeposit - previousDeposit;

      const greenTrades = monthItems
        .filter((day) => day.variant !== "neg")
        .map((day) => Number(day.trades) || 0);
      const fallbackTrades = monthItems.map((day) => Number(day.trades) || 0);
      const baselineSource = greenTrades.length ? greenTrades : fallbackTrades;
      const baselineTrades =
        baselineSource.length > 0
          ? baselineSource.reduce((sum, trades) => sum + trades, 0) / baselineSource.length
          : 1;
      const severeTiltThreshold = Math.max(3, Math.ceil(baselineTrades * 3));

      const isCriticalTilt =
        latest.variant === "neg" && latest.trades >= severeTiltThreshold && depositDelta < 0;
      if (isCriticalTilt) {
        items.push({
          key: "critical-tilt",
          level: "critical",
          label: locale === "ru" ? "Критический тильт" : locale === "uk" ? "Критичний тільт" : "Critical Tilt",
          message:
            locale === "ru"
              ? `Красный день + ${latest.trades} сделок (выше x3 базовой нормы) + падение депозита. Остановите торговлю и сбросьте режим.`
              : locale === "uk"
                ? `Червоний день + ${latest.trades} угод (вище x3 базової норми) + падіння депозиту. Зупиніть торгівлю та скиньте режим.`
                : `Red day + ${latest.trades} trades (above x3 baseline) + deposit drop. Stop trading and reset rules now.`,
        });
      }

      const isLuckyProfit = latest.variant === "neg" && depositDelta > 0;
      if (isLuckyProfit) {
        items.push({
          key: "lucky-profit",
          level: "warn",
          label: locale === "ru" ? "Лудка в плюс" : locale === "uk" ? "Лудка в плюс" : "Lucky Profit",
          message:
            locale === "ru"
              ? "Депозит вырос в красный день. Профит маскирует нарушение правил."
              : locale === "uk"
                ? "Депозит виріс у червоний день. Профіт маскує порушення правил."
                : "Deposit grew on a red day. Profit is masking rule-breaking behavior.",
        });
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
      const recent = monthItems.slice(-3);
      const recentRedCount = recent.filter((day) => day.variant === "neg").length;
      const isRegression = longestGreenRun >= 4 && recentRedCount >= 2;
      if (isRegression) {
        items.push({
          key: "regression",
          level: "warn",
          label: locale === "ru" ? "Регрессия" : locale === "uk" ? "Регресія" : "Regression",
          message:
            locale === "ru"
              ? "После длинной зеленой серии выросло число красных дней. Возьмите белый день для перезапуска."
              : locale === "uk"
                ? "Після довгої зеленої серії зросла кількість червоних днів. Візьміть білий день для перезапуску."
                : "After a long green run, red days increased. Consider a white day for reset.",
        });
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
        items.push({
          key: "divergence",
          level: "warn",
          label: locale === "ru" ? "Риск дивергенции" : locale === "uk" ? "Ризик дивергенції" : "Divergence Risk",
          message:
            locale === "ru"
              ? "Депозит растет, а тренд дисциплины падает. Часто это перед нестабильной просадкой."
              : locale === "uk"
                ? "Депозит зростає, а тренд дисципліни падає. Часто це перед нестабільною просадкою."
                : "Deposit is rising while discipline trend is falling. This often precedes unstable drawdowns.",
        });
      }

      if (!items.length) {
        items.push({
          key: "healthy",
          level: "ok",
          label: locale === "ru" ? "Стабильное состояние" : locale === "uk" ? "Стабільний стан" : "Healthy State",
          message:
            locale === "ru"
              ? "Критичных риск-паттернов не обнаружено. Держите стабильное качество исполнения."
              : locale === "uk"
                ? "Критичних ризик-патернів не виявлено. Тримайте стабільну якість виконання."
                : "No critical risk pattern detected. Keep execution quality and trade frequency stable.",
        });
      }
    }

    const summaryLevel: SignalLevel = items.some((item) => item.level === "critical")
      ? "critical"
      : items.some((item) => item.level === "warn")
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

    return { summaryLevel, summaryTitle, summaryMessage, items };
  }, [locale, sortedEntries, viewMonth, viewYear]);

  const monthlyReview = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    const monthItems = sortedEntries
      .filter(([dateKey]) => dateKey.startsWith(monthPrefix))
      .map(([dateKey, entry]) => ({ dateKey, ...entry }));
    const values = monthItems;

    const formatSignedUsd = (value: number) => {
      const sign = value >= 0 ? "+" : "-";
      const rounded = Math.round(Math.abs(value));
      return `${sign}$${rounded.toLocaleString(locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US")}`;
    };

    if (!values.length) {
      return {
        totalTrades: "0",
        avgTrades: "0.0",
        greenPnlSum: "$0",
        redPnlSum: "$0",
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
  }, [locale, sortedEntries, viewMonth, viewYear]);

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
      const x = bounds.left + (width * index) / steps;
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
            <p>{stats.advice}</p>
          </div>

        </div>
      </div>

      <div className={styles.monthlyRow}>
        <div className={`${styles.panel} ${styles.weekly}`}>
          <h4>{ui.monthlyReview}</h4>
          <div className={styles.weeklyGrid}>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.totalTrades}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.totalTradesHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.totalTradesHint}</span>
                </span>
              </div>
              <strong>{monthlyReview.totalTrades}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.avgTrades}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.avgTradesHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.avgTradesHint}</span>
                </span>
              </div>
              <strong>{monthlyReview.avgTrades}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.greenPnlSum}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.greenPnlSumHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.greenPnlSumHint}</span>
                </span>
              </div>
              <strong>{monthlyReview.greenPnlSum}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.redPnlSum}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.redPnlSumHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.redPnlSumHint}</span>
                </span>
              </div>
              <strong>{monthlyReview.redPnlSum}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.redDamageShare}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.redDamageShareHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.redDamageShareHint}</span>
                </span>
              </div>
              <strong>{monthlyReview.redDamageShare}</strong>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.metricLabel}>
                <span>{ui.maxDrawdown}</span>
                <span className={styles.metricHelp} tabIndex={0} aria-label={ui.maxDrawdownHint}>
                  ?
                  <span className={styles.metricTooltip}>{ui.maxDrawdownHint}</span>
                </span>
              </div>
              <strong>{monthlyReview.maxDrawdown}</strong>
            </div>
          </div>
        </div>

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
            {signalizer.items.map((item) => (
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
