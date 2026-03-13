"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from "./TrackerClient.module.css";
import type { Locale } from "@/lib/i18n";

type Variant = "neg" | "pos" | "pos-outline";
type Entry = { result: -1 | 1; variant: Variant; deposit: number; trades: number };
type ChartHover = {
  x: number;
  y: number;
  label: string;
  dateKey: string;
  pnl: number;
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
type MonthBaseSource = "manual" | "inferred";

type MonthAggregate = {
  month: number;
  label: string;
  trades: number;
  greenDays: number;
  redDays: number;
  filledDays: number;
  startDeposit: number;
  endDeposit: number;
  pnl: number;
  disciplineScore: number;
};
type QuarterGroup = {
  key: string;
  label: string;
  months: Array<{
    month: number;
    label: string;
    cells: Array<
      | { kind: "empty" }
      | { kind: "day"; day: number; dateKey: string; entry?: Entry; isSelected: boolean; isFuture: boolean }
    >;
    aggregate: MonthAggregate;
  }>;
  trades: number;
  filledDays: number;
  pnl: number;
  disciplineScore: number;
};

type Props = {
  userKey: string;
  locale: Locale;
};

type PendingSync =
  | {
      type: "upsert";
      entry: Entry;
    }
  | {
      type: "delete";
    };

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
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
  const pendingSyncKey = `jour-tracker-pending-${userKey}`;
  const reviewDisplayKey = `jour-tracker-review-display-${userKey}`;
  const monthBaseKey = `jour-tracker-month-base-${userKey}`;
  const monthBaseSourceKey = `jour-tracker-month-base-source-${userKey}`;
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
  const [monthSetupOpen, setMonthSetupOpen] = useState(false);
  const [monthSetupDateKey, setMonthSetupDateKey] = useState("");
  const [monthSetupValue, setMonthSetupValue] = useState("");
  const [monthSetupError, setMonthSetupError] = useState("");
  const [trackerView, setTrackerView] = useState<"month" | "year">("month");
  const [reviewDisplayMode] = useState<"$" | "%">(() => {
    if (typeof window === "undefined") return "$";
    try {
      const raw = localStorage.getItem(reviewDisplayKey);
      return raw === "%" ? "%" : "$";
    } catch {
      return "$";
    }
  });
  const [syncError, setSyncError] = useState("");
  const [monthBaseByMonth, setMonthBaseByMonth] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(monthBaseKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, number>;
      if (!parsed || typeof parsed !== "object") return {};
      return Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0)
      );
    } catch {
      return {};
    }
  });
  const [monthBaseSourceByMonth, setMonthBaseSourceByMonth] = useState<Record<string, MonthBaseSource>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(monthBaseSourceKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, MonthBaseSource>;
      if (!parsed || typeof parsed !== "object") return {};
      return Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => value === "manual" || value === "inferred")
      );
    } catch {
      return {};
    }
  });
  const [pendingSyncs, setPendingSyncs] = useState<Record<string, PendingSync>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(pendingSyncKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, PendingSync>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [shareLoading, setShareLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [copyFlash, setCopyFlash] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [chartHover, setChartHover] = useState<ChartHover | null>(null);
  const [isTouchMode, setIsTouchMode] = useState(false);
  const [activeHelpKey, setActiveHelpKey] = useState<string | null>(null);
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
        yearTracker: "Трекер года",
        trackerMonth: "Месяц",
        trackerYear: "Год",
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
        disciplineScoreHint: "Процент дисциплинированных дней за выбранный период: зеленые и осознанно пропущенные дни / все заполненные дни.",
        greenStreakHint: "Максимальная серия дисциплинированных дней подряд за выбранный период.",
        redStreakHint: "Максимальная серия дней с нарушением ТС подряд за выбранный период.",
        mon: "Пн",
        tue: "Вт",
        wed: "Ср",
        thu: "Чт",
        fri: "Пт",
        sat: "Сб",
        sun: "Вс",
        aiAdvice: "Совет по дисциплине",
        monthlyReview: "Обзор месяца",
        yearlyReview: "Обзор года",
        bestMonth: "Лучший месяц",
        worstMonth: "Худший месяц",
        tradingDays: "Торговых дней",
        endBalance: "Баланс на конец",
        avgTradesDay: "Сделок / день",
        filledMonths: "Активных месяцев",
        calendarYear: "Календарь года",
        yearOverview: "Годовой обзор",
        totalTrades: "Сделок за месяц",
        avgTrades: "Сделок в день (сред.)",
        greenPnlSum: "PnL хороших дней",
        redPnlSum: "PnL плохих дней",
        avgErrorCost: "Средняя цена ошибки",
        maxDrawdown: "Макс. просадка",
        netPnl: "Net PnL (месяц)",
        redDaysRate: "% красных дней",
        currencyMode: "$",
        percentMode: "%",
        newMonth: "Новый месяц",
        monthSetupTitle: "Новый месяц",
        monthSetupDescription: "Введите стартовый депозит месяца",
        continueCta: "Продолжить",
        monthStartDeposit: "Стартовый депозит месяца",
        monthStartDepositHint: "От этой суммы считаются %-метрики месяца. Max Drawdown считается отдельно от локального пика внутри месяца.",
        monthStartDepositHelper: "Указывается один раз для текущего месяца.",
        enterMonthStartDeposit: "Введите стартовый депозит",
        monthStartDepositRequired: "Введите стартовый депозит месяца.",
        monthStartDepositPositive: "Стартовый депозит месяца должен быть больше 0.",
        monthBaseManualHint: "База месяца задана вручную.",
        monthBaseInferredHint: "База месяца определена автоматически по прошлому балансу или первому доступному дню.",
        monthSetupRequired: "Сначала задайте стартовый депозит месяца.",
        totalTradesHint: "Общее количество открытых сделок за выбранный месяц (сумма всех сделок по заполненным дням).",
        avgTradesHint: "Среднее число сделок в день: сделки за месяц / количество заполненных дней.",
        greenPnlSumHint: "Суммарный результат зеленых дней текущего месяца. В режиме % считается от стартового депозита месяца.",
        redPnlSumHint: "Суммарный результат красных дней текущего месяца. В режиме % считается от стартового депозита месяца.",
        avgErrorCostHint:
          "Средний убыток за 1 красный день: сумма убытков красных дней / количество красных дней.",
        maxDrawdownHint: "Максимальная просадка депозита от локального пика внутри месяца.",
        netPnlHint: "Итоговый результат месяца. В режиме % считается от стартового депозита месяца.",
        redDaysRateHint: "Процент красных дней от всех заполненных дней месяца.",
        signalizer: "Сигнализатор",
        creating: "Создание...",
        shareSequence: "Поделиться серией",
        sharePopupTitle: "Поделиться серией",
        sharePopupHint: "Ссылка готова. Скопируйте её и отправьте куда угодно.",
        copy: "Копировать",
        copied: "Скопировано",
        close: "Закрыть",
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
        sessionExpiredShare: "Сессия истекла. Перенаправляем на вход…",
      };
    }
    if (locale === "uk") {
      return {
        monthTracker: "Трекер місяця",
        yearTracker: "Трекер року",
        trackerMonth: "Місяць",
        trackerYear: "Рік",
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
        disciplineScoreHint: "Відсоток дисциплінованих днів за вибраний період: зелені та свідомо пропущені дні / усі заповнені дні.",
        greenStreakHint: "Максимальна серія дисциплінованих днів поспіль за вибраний період.",
        redStreakHint: "Максимальна серія днів із порушенням ТС поспіль за вибраний період.",
        mon: "Пн",
        tue: "Вт",
        wed: "Ср",
        thu: "Чт",
        fri: "Пт",
        sat: "Сб",
        sun: "Нд",
        aiAdvice: "Порада щодо дисципліни",
        monthlyReview: "Огляд місяця",
        yearlyReview: "Огляд року",
        bestMonth: "Найкращий місяць",
        worstMonth: "Найгірший місяць",
        tradingDays: "Торгових днів",
        endBalance: "Баланс на кінець",
        avgTradesDay: "Угод / день",
        filledMonths: "Активних місяців",
        calendarYear: "Календар року",
        yearOverview: "Річний огляд",
        totalTrades: "Угод за місяць",
        avgTrades: "Угод на день (серед.)",
        greenPnlSum: "PnL хороших днів",
        redPnlSum: "PnL поганих днів",
        avgErrorCost: "Середня ціна помилки",
        maxDrawdown: "Макс. просадка",
        netPnl: "Net PnL (місяць)",
        redDaysRate: "% червоних днів",
        currencyMode: "$",
        percentMode: "%",
        newMonth: "Новий місяць",
        monthSetupTitle: "Новий місяць",
        monthSetupDescription: "Введіть стартовий депозит місяця",
        continueCta: "Продовжити",
        monthStartDeposit: "Стартовий депозит місяця",
        monthStartDepositHint: "Від цієї суми рахуються %-метрики місяця. Max Drawdown рахується окремо від локального піка всередині місяця.",
        monthStartDepositHelper: "Вказується один раз для поточного місяця.",
        enterMonthStartDeposit: "Введіть стартовий депозит",
        monthStartDepositRequired: "Введіть стартовий депозит місяця.",
        monthStartDepositPositive: "Стартовий депозит місяця має бути більше 0.",
        monthBaseManualHint: "База місяця задана вручну.",
        monthBaseInferredHint: "База місяця визначена автоматично за минулим балансом або першим доступним днем.",
        monthSetupRequired: "Спочатку задайте стартовий депозит місяця.",
        totalTradesHint: "Загальна кількість відкритих угод за вибраний місяць (сума всіх угод у заповнених днях).",
        avgTradesHint: "Середня кількість угод на день: угоди за місяць / кількість заповнених днів.",
        greenPnlSumHint: "Сумарний результат зелених днів поточного місяця. У режимі % рахується від стартового депозиту місяця.",
        redPnlSumHint: "Сумарний результат червоних днів поточного місяця. У режимі % рахується від стартового депозиту місяця.",
        avgErrorCostHint:
          "Середній збиток за 1 червоний день: сума збитків червоних днів / кількість червоних днів.",
        maxDrawdownHint: "Максимальна просадка депозиту від локального піка всередині місяця.",
        netPnlHint: "Підсумковий результат місяця. У режимі % рахується від стартового депозиту місяця.",
        redDaysRateHint: "Відсоток червоних днів від усіх заповнених днів місяця.",
        signalizer: "Сигналізатор",
        creating: "Створення...",
        shareSequence: "Поділитися серією",
        sharePopupTitle: "Поділитися серією",
        sharePopupHint: "Посилання готове. Скопіюйте його та надішліть будь-де.",
        copy: "Копіювати",
        copied: "Скопійовано",
        close: "Закрити",
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
        sessionExpiredShare: "Сесія завершилась. Перенаправляємо на вхід…",
      };
    }
    return {
      monthTracker: "Monthly Tracker",
      yearTracker: "Yearly Tracker",
      trackerMonth: "Month",
      trackerYear: "Year",
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
      disciplineScoreHint: "Share of disciplined days in the selected period: green and intentionally skipped days / all filled days.",
      greenStreakHint: "Longest streak of disciplined days in a row for the selected period.",
      redStreakHint: "Longest streak of rule-breaking days in a row for the selected period.",
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
      sun: "Sun",
      aiAdvice: "Discipline advice",
      monthlyReview: "Monthly review",
      yearlyReview: "Yearly review",
      bestMonth: "Best month",
      worstMonth: "Worst month",
      tradingDays: "Trading days",
      endBalance: "Ending balance",
      avgTradesDay: "Trades / day",
      filledMonths: "Active months",
      calendarYear: "Year calendar",
      yearOverview: "Year overview",
      totalTrades: "Total trades (month)",
      avgTrades: "Avg trades/day",
      greenPnlSum: "PnL of good days",
      redPnlSum: "PnL of bad days",
      avgErrorCost: "Avg Error Cost",
      maxDrawdown: "Max drawdown",
      netPnl: "Net PnL (month)",
      redDaysRate: "% red days",
      currencyMode: "$",
      percentMode: "%",
      newMonth: "New month",
      monthSetupTitle: "New month",
      monthSetupDescription: "Enter the month starting deposit",
      continueCta: "Continue",
      monthStartDeposit: "Month starting deposit",
      monthStartDepositHint: "Monthly % metrics are calculated from this amount. Max drawdown is still measured from the local peak within the month.",
      monthStartDepositHelper: "Set once for the current month.",
      enterMonthStartDeposit: "Enter month starting deposit",
      monthStartDepositRequired: "Enter the month starting deposit.",
      monthStartDepositPositive: "Month starting deposit must be greater than 0.",
      monthBaseManualHint: "This month base was set manually.",
      monthBaseInferredHint: "This month base was inferred from the prior balance or the first available day.",
      monthSetupRequired: "Set the month starting deposit first.",
      totalTradesHint: "Total number of opened trades in the selected month (sum across all filled days).",
      avgTradesHint: "Average trades per day: monthly total trades / number of filled days.",
      greenPnlSumHint: "Combined result of green days in the current month. In % mode it is calculated from the month starting deposit.",
      redPnlSumHint: "Combined result of red days in the current month. In % mode it is calculated from the month starting deposit.",
      avgErrorCostHint:
        "Average loss per red day: total red-day losses / number of red days.",
      maxDrawdownHint: "Maximum deposit drop from a local peak within the month.",
      netPnlHint: "Net result of the month. In % mode it is calculated from the month starting deposit.",
      redDaysRateHint: "Share of red days among all filled days this month.",
      signalizer: "Signalizer",
      creating: "Creating...",
      shareSequence: "Share sequence",
      sharePopupTitle: "Share sequence",
      sharePopupHint: "Your link is ready. Copy it and share it anywhere.",
      copy: "Copy",
      copied: "Copied",
      close: "Close",
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
      sessionExpiredShare: "Session expired. Redirecting to login…",
    };
  }, [locale]);

  const storageKey = `jour-tracker-${userKey}`;
  const pendingSyncCount = Object.keys(pendingSyncs).length;

  const trackerSyncStatusText = useMemo(() => {
    if (pendingSyncCount === 0) return "";
    if (locale === "ru") {
      return pendingSyncCount === 1
        ? "1 изменение не синхронизировано"
        : `${pendingSyncCount} изменений не синхронизировано`;
    }
    if (locale === "uk") {
      return pendingSyncCount === 1
        ? "1 зміну не синхронізовано"
        : `${pendingSyncCount} змін не синхронізовано`;
    }
    return pendingSyncCount === 1 ? "1 change not synced" : `${pendingSyncCount} changes not synced`;
  }, [locale, pendingSyncCount]);

  const syncFailureMessage = (action: "save" | "delete") =>
    locale === "ru"
      ? action === "save"
        ? "Сохранено локально, но cloud sync не удался. Повторите попытку."
        : "Удалено локально, но cloud sync не удался. Повторите попытку."
      : locale === "uk"
        ? action === "save"
          ? "Збережено локально, але cloud sync не вдався. Спробуйте ще раз."
          : "Видалено локально, але cloud sync не вдався. Спробуйте ще раз."
        : action === "save"
          ? "Saved locally, but cloud sync failed. Try again."
          : "Cleared locally, but cloud sync failed. Try again.";

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
          const mergedData = { ...payload.data };
          Object.entries(pendingSyncs).forEach(([dateKey, pending]) => {
            if (pending.type === "delete") {
              delete mergedData[dateKey];
              return;
            }
            mergedData[dateKey] = pending.entry;
          });
          setDayData(mergedData);
          setSyncError("");
          try {
            localStorage.setItem(storageKey, JSON.stringify(mergedData));
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
  }, [locale, pendingSyncs, storageKey, userKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(dayData));
    } catch {
      // ignore storage errors
    }
  }, [dayData, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(pendingSyncKey, JSON.stringify(pendingSyncs));
    } catch {
      // ignore storage errors
    }
  }, [pendingSyncKey, pendingSyncs]);

  useEffect(() => {
    try {
      localStorage.setItem(viewStateKey, JSON.stringify({ year: viewYear, month: viewMonth }));
    } catch {
      // ignore storage errors
    }
  }, [viewMonth, viewStateKey, viewYear]);

  useEffect(() => {
    try {
      localStorage.setItem(reviewDisplayKey, reviewDisplayMode);
    } catch {
      // ignore storage errors
    }
  }, [reviewDisplayKey, reviewDisplayMode]);

  useEffect(() => {
    try {
      localStorage.setItem(monthBaseKey, JSON.stringify(monthBaseByMonth));
    } catch {
      // ignore storage errors
    }
  }, [monthBaseByMonth, monthBaseKey]);

  useEffect(() => {
    try {
      localStorage.setItem(monthBaseSourceKey, JSON.stringify(monthBaseSourceByMonth));
    } catch {
      // ignore storage errors
    }
  }, [monthBaseSourceByMonth, monthBaseSourceKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const apply = () => setIsTouchMode(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!isTouchMode) return;
    const close = () => setActiveHelpKey(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [isTouchMode]);

  const sortedEntries = useMemo(
    () => Object.entries(dayData).sort(([a], [b]) => a.localeCompare(b)),
    [dayData]
  );

  const stats = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    const yearPrefix = `${viewYear}-`;
    const activePrefix = trackerView === "month" ? monthPrefix : yearPrefix;
    const values = sortedEntries
      .filter(([dateKey]) => dateKey.startsWith(activePrefix))
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
  }, [sortedEntries, trackerView, viewMonth, viewYear]);

  const signalizer = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    const yearPrefix = `${viewYear}-`;
    const activePrefix = trackerView === "month" ? monthPrefix : yearPrefix;
    const monthItems = sortedEntries
      .filter(([dateKey]) => dateKey.startsWith(activePrefix))
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
          "Нужно минимум 2 заполненных дня для сигналов.",
          "Потрібно щонайменше 2 заповнені дні для сигналів.",
          "Need at least 2 filled days for signals.",
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
            "Депозит и дисциплина растут вместе — сохраняйте текущий риск.",
            "Депозит і дисципліна ростуть разом — зберігайте поточний ризик.",
            "Deposit and discipline rise together — keep current risk.",
        ),
      );
      }
      if (bTrend === "up" && dTrend === "down") {
        addSignal(
          "euphoria",
          "warn",
          t("Эйфория", "Ейфорія", "Euphoria"),
        t(
            "Депозит растет, но дисциплина падает — снизьте риск и сделки.",
            "Депозит росте, але дисципліна падає — зменште ризик і угоди.",
            "Deposit grows while discipline drops — reduce risk and trades.",
        ),
      );
      }
      if (bTrend === "down" && dTrend === "up") {
        addSignal(
          "system-test",
          "ok",
          t("Тест системы", "Тест системи", "System Test"),
        t(
            "Рынок сложный, но дисциплина в норме — ТС не менять.",
            "Ринок складний, але дисципліна в нормі — ТС не змінювати.",
            "Market is tough, discipline is fine — keep the strategy.",
        ),
      );
      }
      if (bTrend === "down" && dTrend === "down") {
        addSignal(
          "tilt-zone",
          "critical",
          t("Зона тильта", "Зона тільту", "Tilt Zone"),
        t(
            "И депозит, и дисциплина снижаются — пауза и жесткий лимит.",
            "І депозит, і дисципліна знижуються — пауза і жорсткий ліміт.",
            "Both deposit and discipline are down — pause and hard limits.",
        ),
      );
      }
      if (bTrend === "flat" && dTrend === "down") {
        addSignal(
          "drift",
          "warn",
          t("Дрейф поведения", "Дрейф поведінки", "Drift"),
        t(
            "Боковик при падении дисциплины — уберите лишние входы.",
            "Боковик при падінні дисципліни — приберіть зайві входи.",
            "Flat results with weaker discipline — cut marginal entries.",
        ),
      );
      }
      if (bTrend === "flat" && dTrend === "up") {
        addSignal(
          "pre-breakout",
          "ok",
          t("Подготовка к росту", "Підготовка до росту", "Pre Breakout"),
        t(
            "Дисциплина растет в боковике — хорошая база перед ростом.",
            "Дисципліна росте в боковику — гарна база перед ростом.",
            "Discipline improves in range — good base before growth.",
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
            `Красный день + ${latest.trades} сделок при падении депозита — немедленная пауза.`,
            `Червоний день + ${latest.trades} угод при падінні депозиту — негайна пауза.`,
            `Red day + ${latest.trades} trades with deposit drop — immediate pause.`,
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
            "Профит в красный день маскирует нарушение правил.",
            "Профіт у червоний день маскує порушення правил.",
            "Profit on a red day masks rule-breaking.",
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
            "Дисциплина падает несколько дней — ранний риск просадки.",
            "Дисципліна падає кілька днів — ранній ризик просадки.",
            "Discipline drops for several days — early drawdown risk.",
        ),
      );
      }
      if (bTrend === "up" && redDays > 0) {
        addSignal(
          "false-confidence",
          "warn",
          t("Ложная уверенность", "Хибна впевненість", "False Confidence"),
        t(
            "Рост депозита с красными днями — риск ложной уверенности.",
            "Ріст депозиту з червоними днями — ризик хибної впевненості.",
            "Balance growth with red days signals false confidence.",
        ),
      );
      }
      if (greenProfitOnly > 0 && redLossOnly > greenProfitOnly * 0.3) {
        addSignal(
          "self-sabotage",
          "warn",
          t("Самосаботаж", "Самосаботаж", "Self Sabotage"),
        t(
            "Нарушения съедают прибыль системных дней — ужесточите лимит.",
            "Порушення зʼїдають прибуток системних днів — посильте ліміт.",
            "Rule-breaking eats system profits — tighten trade limits.",
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
            "После зеленой серии пошла регрессия — возьмите белый день.",
            "Після зеленої серії пішла регресія — візьміть білий день.",
            "Regression after green streak — take a white reset day.",
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
            "Депозит растет при падающей дисциплине — риск дивергенции.",
            "Депозит росте при падінні дисципліни — ризик дивергенції.",
            "Deposit rises while discipline falls — divergence risk.",
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
            "Сильная зеленая серия — держите темп без ускорения.",
            "Сильна зелена серія — тримайте темп без прискорення.",
            "Strong green streak — keep pace, avoid acceleration.",
        ),
      );
      }
      if (recentRedCount >= 2) {
        addSignal(
          "red-streak",
          "critical",
          t("Красная серия", "Червона серія", "Red Streak"),
        t(
            "Серия красных дней — потеря контроля, нужна пауза.",
            "Серія червоних днів — втрата контролю, потрібна пауза.",
            "Red streak means loss of control — take a pause.",
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
            "Красный день после зеленой серии — типичный срыв уверенности.",
            "Червоний день після зеленої серії — типовий зрив впевненості.",
            "Red day after green streak indicates confidence slip.",
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
            "После красной серии контроль вернулся — держите темп.",
            "Після червоної серії контроль повернувся — тримайте темп.",
            "Control returned after red streak — keep the pace.",
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
            "3 дня подряд активность выше нормы — ограничьте сделки.",
            "3 дні поспіль активність вище норми — обмежте угоди.",
            "3 days above baseline activity — cap daily trades.",
        ),
      );
      }
      if (latest.variant === "neg" && latest.trades > overtradeThreshold && previous.variant === "neg") {
        addSignal(
          "tilt-spike",
          "critical",
          t("Всплеск тильта", "Сплеск тільту", "Tilt Spike"),
        t(
            "После красного дня всплеск сделок — похоже на revenge.",
            "Після червоного дня сплеск угод — схоже на revenge.",
            "Trade spike after red day suggests revenge trading.",
        ),
      );
      }
      if (previous.variant !== "neg" && latest.trades > overtradeThreshold && latest.variant !== "neg") {
        addSignal(
          "ego-spike",
          "warn",
          t("Эго-всплеск", "Его-сплеск", "Ego Spike"),
        t(
            "После удачного дня активность выросла слишком резко.",
            "Після вдалого дня активність зросла занадто різко.",
            "Activity jumped too hard after a good day.",
        ),
      );
      }
      if (bTrend === "down" && (latest.trades || 0) < lowTradesThreshold) {
        addSignal(
          "freeze",
          "warn",
          t("Фриз", "Фриз", "Freeze"),
        t(
            "Депозит падает при низкой активности — вернитесь к базе.",
            "Депозит падає при низькій активності — поверніться до бази.",
            "Balance falls with very low activity — return to base routine.",
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
            "Белые дни помогают дисциплине — фильтрация работает.",
            "Білі дні допомагають дисципліні — фільтрація працює.",
            "White days support discipline — filtering works.",
        ),
      );
      }
      if (recentSkipCount >= 2 && dTrend === "down" && bTrend === "down") {
        addSignal(
          "avoidance",
          "warn",
          t("Избегание", "Уникання", "Avoidance"),
        t(
            "Много белых дней при падении показателей — это избегание.",
            "Багато білих днів при падінні показників — це уникання.",
            "Many white days with falling metrics suggest avoidance.",
        ),
      );
      }
      if (recentSkipCount >= 2 && latest.trades > overtradeThreshold && latest.variant === "neg") {
        addSignal(
          "fomo-return",
          "warn",
          t("FOMO-возврат", "FOMO-повернення", "FOMO Return"),
        t(
            "После белых дней возврат с перегрузом сделок — FOMO.",
            "Після білих днів повернення з перевантаженням угод — FOMO.",
            "After white days, overloaded comeback in trades — FOMO.",
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
            "Минусовой, но дисциплинированный день — норма системы.",
            "Мінусовий, але дисциплінований день — норма системи.",
            "Losing but disciplined day is normal for the system.",
        ),
      );
      }
      if (latest.variant === "neg" && latestDelta > 0) {
        addSignal(
          "chaotic-win",
          "warn",
          t("Хаотичный плюс", "Хаотичний плюс", "Chaotic Win"),
        t(
            "Профит в красный день — опасное закрепление плохой привычки.",
            "Профіт у червоний день — небезпечне закріплення поганої звички.",
            "Profit on a red day reinforces bad habits.",
        ),
      );
      }
      if (latest.variant === "neg" && latestDelta < 0) {
        addSignal(
          "chaotic-loss",
          "critical",
          t("Хаотичный минус", "Хаотичний мінус", "Chaotic Loss"),
        t(
            "Красный день с убытком — срочно вернитесь к базовым лимитам.",
            "Червоний день зі збитком — терміново поверніться до базових лімітів.",
            "Red day with loss — immediately return to baseline limits.",
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
            "Дисциплина ниже 60% — только ограниченный режим торговли.",
            "Дисципліна нижче 60% — лише обмежений режим торгівлі.",
            "Discipline below 60% — use restricted trading mode.",
        ),
      );
      }
      if (redDamageShare > 50) {
        addSignal(
          "red-cost",
          "warn",
          t("Высокая цена красных дней", "Висока ціна червоних днів", "High Red-Day Cost"),
        t(
            "Красные дни съедают >50% зеленой прибыли — снижайте риск.",
            "Червоні дні зʼїдають >50% зеленої прибутку — знижуйте ризик.",
            "Red days consume >50% of green profits — reduce risk.",
        ),
      );
      }
      if (avgTradesRed > avgTradesGreen && redDays >= 2 && greenDays >= 2) {
        addSignal(
          "trade-imbalance",
          "warn",
          t("Дисбаланс сделок", "Дисбаланс угод", "Trade Imbalance"),
        t(
            "В красные дни сделок больше, чем в зеленые — эмоциональный дисбаланс.",
            "У червоні дні угод більше, ніж у зелені — емоційний дисбаланс.",
            "More trades on red days than green days — emotional imbalance.",
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
            "Низкая частота и высокая дисциплина — профиль про-режима.",
            "Низька частота й висока дисципліна — профіль про-режиму.",
            "Low frequency and high discipline — pro-mode profile.",
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
            "Стабильный ритм сделок и дисциплины при росте депозита.",
            "Стабільний ритм угод і дисципліни при зростанні депозиту.",
            "Stable trade rhythm and discipline with deposit growth.",
        ),
      );
      }

      if (!items.length) {
        addSignal(
          "healthy",
          "ok",
          t("Стабильное состояние", "Стабільний стан", "Healthy State"),
        t(
            "Критичных риск-паттернов нет — держите текущий режим.",
            "Критичних ризик-патернів немає — тримайте поточний режим.",
            "No critical risk patterns — keep your current routine.",
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
  }, [locale, sortedEntries, trackerView, viewMonth, viewYear]);

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
    const activePrefix = trackerView === "month" ? monthPrefix : yearPrefix;
    const periodItems = sortedEntries
      .filter(([dateKey]) => dateKey.startsWith(activePrefix))
      .map(([dateKey, entry]) => ({ dateKey, ...entry }));
    const values = periodItems;

    const formatSignedUsd = (value: number) => {
      const sign = value >= 0 ? "+" : "-";
      const rounded = Math.round(Math.abs(value));
      return `${sign}${rounded.toLocaleString(locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US")}$`;
    };
    const formatUsd = (value: number) =>
      `${Math.round(Math.abs(value)).toLocaleString(locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US")}$`;
    const formatSignedPercent = (value: number) => {
      const sign = value >= 0 ? "+" : "-";
      return `${sign}${Math.abs(value).toFixed(1)}%`;
    };
    const formatPercent = (value: number) => `${Math.abs(value).toFixed(1)}%`;
    const showPercentValues = trackerView === "month" && reviewDisplayMode === "%";

    if (!values.length) {
      return {
        totalTrades: "0",
        avgTrades: "0.0",
        greenPnlSum: "0$",
        redPnlSum: "0$",
        netPnl: "0$",
        avgErrorCost: "0$",
        maxDrawdown: showPercentValues ? "0.0%" : "0$",
        disciplinedDaysRate: "0%",
        redDaysRate: "0%",
      };
    }

    const totalTradesCount = values.reduce((acc, day) => acc + (Number(day.trades) || 0), 0);
    const avgTrades = (totalTradesCount / values.length).toFixed(1);

    let peak = Number(values[0].deposit) || 0;
    let maxDrawdownCash = 0;
    let maxDrawdownPct = 0;
    for (const day of values) {
      const dep = Number(day.deposit) || 0;
      if (dep > peak) peak = dep;
      const cashDrop = Math.max(0, peak - dep);
      if (cashDrop > maxDrawdownCash) maxDrawdownCash = cashDrop;
      if (peak > 0) {
        const dd = ((peak - dep) / peak) * 100;
        if (dd > maxDrawdownPct) maxDrawdownPct = dd;
      }
    }

    const deltas = values.map((day, index) => {
      const curr = Number(day.deposit) || 0;
      const monthBase = Number(monthBaseByMonth[getMonthKey(day.dateKey)]) || 0;
      if (index === 0 || getMonthKey(values[index - 1].dateKey) !== getMonthKey(day.dateKey)) {
        return { day: day.dateKey, delta: monthBase > 0 ? curr - monthBase : 0, variant: day.variant, monthBase };
      }
      const prev = Number(values[index - 1].deposit) || 0;
      return { day: day.dateKey, delta: curr - prev, variant: day.variant, monthBase };
    });

    const greenPnl = deltas
      .filter((day) => day.variant === "pos" || day.variant === "pos-outline")
      .reduce((acc, day) => acc + day.delta, 0);
    const redPnl = deltas.filter((day) => day.variant === "neg").reduce((acc, day) => acc + day.delta, 0);

    const redLossOnly = deltas
      .filter((day) => day.variant === "neg")
      .reduce((acc, day) => acc + Math.abs(Math.min(day.delta, 0)), 0);
    const redDaysCount = values.filter((day) => day.variant === "neg").length;
    const disciplinedDaysCount = values.filter((day) => day.variant === "pos" || day.variant === "pos-outline").length;
    const disciplinedDaysRate = values.length > 0 ? Math.round((disciplinedDaysCount / values.length) * 100) : 0;
    const redDaysRate = values.length > 0 ? Math.round((redDaysCount / values.length) * 100) : 0;
    const avgErrorCost = redDaysCount > 0 ? `${Math.round(redLossOnly / redDaysCount).toLocaleString(locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US")}$` : "0$";
    const firstMonthBase = Number(monthBaseByMonth[getMonthKey(values[0].dateKey)]) || 0;
    const endDeposit = Number(values[values.length - 1].deposit) || 0;
    const netPnl = firstMonthBase > 0 ? endDeposit - firstMonthBase : 0;
    const toPercent = (value: number) => (firstMonthBase > 0 ? (value / firstMonthBase) * 100 : 0);
    const greenPnlDisplay = showPercentValues ? formatSignedPercent(toPercent(greenPnl)) : formatSignedUsd(greenPnl);
    const redPnlDisplay = showPercentValues ? formatSignedPercent(toPercent(redPnl)) : formatSignedUsd(redPnl);
    const netPnlDisplay = showPercentValues ? formatSignedPercent(toPercent(netPnl)) : formatSignedUsd(netPnl);
    const maxDrawdownDisplay = showPercentValues ? formatPercent(maxDrawdownPct) : formatUsd(maxDrawdownCash);

    return {
      totalTrades: `${totalTradesCount}`,
      avgTrades,
      greenPnlSum: greenPnlDisplay,
      redPnlSum: redPnlDisplay,
      netPnl: netPnlDisplay,
      avgErrorCost,
      maxDrawdown: maxDrawdownDisplay,
      disciplinedDaysRate: `${disciplinedDaysRate}%`,
      redDaysRate: `${redDaysRate}%`,
    };
  }, [locale, monthBaseByMonth, reviewDisplayMode, sortedEntries, trackerView, viewMonth, viewYear]);

  const yearMonthlyAggregates = useMemo<MonthAggregate[]>(() => {
    if (trackerView !== "year") {
      return [];
    }

    const numberLocale = locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US";

    return Array.from({ length: 12 }, (_, month) => {
      const monthPrefix = `${viewYear}-${String(month + 1).padStart(2, "0")}-`;
      const items = sortedEntries
        .filter(([dateKey]) => dateKey.startsWith(monthPrefix))
        .map(([, entry]) => entry);
      const filledDays = items.length;
      const trades = items.reduce((sum, item) => sum + (Number(item.trades) || 0), 0);
      const greenDays = items.filter((item) => item.variant !== "neg").length;
      const redDays = items.filter((item) => item.variant === "neg").length;
      const disciplineScore = filledDays > 0 ? Math.round((greenDays / filledDays) * 100) : 0;
      const startDeposit = filledDays > 0 ? Number(items[0].deposit) || 0 : 0;
      const endDeposit = filledDays > 0 ? Number(items[items.length - 1].deposit) || 0 : 0;
      const pnl = filledDays > 1 ? endDeposit - startDeposit : 0;
      const date = new Date(viewYear, month, 1);
      const labelRaw = date.toLocaleDateString(numberLocale, { month: "short" });
      const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);

      return {
        month,
        label,
        trades,
        greenDays,
        redDays,
        filledDays,
        startDeposit,
        endDeposit,
        pnl,
        disciplineScore,
      };
    });
  }, [locale, sortedEntries, trackerView, viewYear]);

  const yearOverview = useMemo(() => {
    if (trackerView !== "year") {
      return {
        activeMonths: 0,
        totalFilledDays: 0,
        totalTrades: 0,
        endingBalance: 0,
        avgTradesDay: "0.0",
        bestMonth: null,
        worstMonth: null,
      };
    }

    const activeMonths = yearMonthlyAggregates.filter((month) => month.filledDays > 0);
    const totalFilledDays = activeMonths.reduce((sum, month) => sum + month.filledDays, 0);
    const totalTrades = activeMonths.reduce((sum, month) => sum + month.trades, 0);
    const endingBalance = activeMonths.length ? activeMonths[activeMonths.length - 1].endDeposit : 0;
    const avgTradesDay = totalFilledDays > 0 ? (totalTrades / totalFilledDays).toFixed(1) : "0.0";
    const bestMonth = [...activeMonths].sort((a, b) => b.pnl - a.pnl)[0] || null;
    const worstMonth = [...activeMonths].sort((a, b) => a.pnl - b.pnl)[0] || null;

    return {
      activeMonths: activeMonths.length,
      totalFilledDays,
      totalTrades,
      endingBalance,
      avgTradesDay,
      bestMonth,
      worstMonth,
    };
  }, [trackerView, yearMonthlyAggregates]);

  const reviewTitle = trackerView === "year" ? ui.yearlyReview : ui.monthlyReview;
  const chartModel = useMemo(() => {
    const bounds = { left: 42, right: 478, top: 28, bottom: 220 };
    const gridY = [28, 76, 124, 172, 220];
    const TRADE_BAR_UNIT = 12; // fixed px per 1 trade
    const TRADE_BAR_CAP = 8; // visual cap, tooltip still shows real value
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    const yearPrefix = `${viewYear}-`;
    const activeEntries = sortedEntries.filter(([dateKey]) =>
      trackerView === "month" ? dateKey.startsWith(monthPrefix) : dateKey.startsWith(yearPrefix),
    );
    const filledEntries = activeEntries;

    let cumulative = 0;
    const visible: Array<{
      day: number;
      dateKey: string;
      label: string;
      cumulative: number;
      deposit: number;
      trades: number;
      variant: Variant | "none";
    }> = filledEntries.map(([dateKey, entry]) => {
      const dayScore = entry.variant === "neg" ? -1 : entry.variant === "pos-outline" ? 0.5 : 1;
      cumulative += dayScore;
      const day = Number(dateKey.slice(-2));
      return {
        day,
        dateKey,
        label: trackerView === "month" ? String(day) : dateKey.slice(5),
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
        bars: [] as Array<{ x: number; y: number; w: number; h: number; kind: "zero" | "ok" | "warn" | "hot"; day: number; label: string; dateKey: string; pnl: number; trades: number; variant: Variant | "none" }>,
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

    const firstDeposit = depositValues[0] || 0;
    const displayMinDeposit = (() => {
      if (trackerView !== "month") {
        const depositRange = Math.max(1, maxDeposit - minDeposit);
        const depositPad = depositRange * 0.08;
        return minDeposit - depositPad;
      }
      const maxAbsDelta = Math.max(1, ...depositValues.map((value) => Math.abs(value - firstDeposit)));
      return firstDeposit - maxAbsDelta * 1.08;
    })();
    const displayMaxDeposit = (() => {
      if (trackerView !== "month") {
        const depositRange = Math.max(1, maxDeposit - minDeposit);
        const depositPad = depositRange * 0.08;
        return maxDeposit + depositPad;
      }
      const maxAbsDelta = Math.max(1, ...depositValues.map((value) => Math.abs(value - firstDeposit)));
      return firstDeposit + maxAbsDelta * 1.08;
    })();
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
    const barWidth = trackerView === "year" ? Math.max(1.4, Math.min(8, width / Math.max(visible.length * 1.25, 1))) : Math.max(4, Math.min(12, width / Math.max(visible.length * 1.8, 1)));
    const bars = visible.map((v, index) => {
      const centerX = bounds.left + barWidth / 2 + ((width - barWidth) * index) / steps;
      const x = centerX - barWidth / 2;
      const cappedTrades = Math.max(0, Math.min(v.trades, TRADE_BAR_CAP));
      const h = cappedTrades === 0 ? 3 : Math.min(cappedTrades * TRADE_BAR_UNIT, tradeMaxHeight);
      const y = bounds.bottom - h;
      const monthBase = Number(monthBaseByMonth[getMonthKey(v.dateKey)]) || 0;
      const prevVisible = visible[index - 1];
      const prevDeposit =
        prevVisible && getMonthKey(prevVisible.dateKey) === getMonthKey(v.dateKey)
          ? prevVisible.deposit
          : monthBase;
      const pnl = v.deposit - prevDeposit;
      const kind: "zero" | "ok" | "warn" | "hot" =
        v.trades === 0 ? "zero" : v.trades <= 2 ? "ok" : v.trades <= 4 ? "warn" : "hot";
      return { x, y, w: barWidth, h, kind, day: v.day, label: v.label, dateKey: v.dateKey, pnl, trades: v.trades, variant: v.variant };
    });

    const numberLocale = locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US";
    const ticks =
      trackerView === "month"
        ? visible.map((v, index) => {
            const x = bounds.left + barWidth / 2 + ((width - barWidth) * index) / steps;
            return { x, label: String(v.day) };
          })
        : visible.reduce<Array<{ x: number; label: string }>>((acc, v, index) => {
            if (!v.dateKey.endsWith("-01")) return acc;
            const x = bounds.left + barWidth / 2 + ((width - barWidth) * index) / steps;
            const monthShort = new Date(`${v.dateKey}T00:00:00`).toLocaleDateString(numberLocale, { month: "short" });
            acc.push({ x, label: monthShort.charAt(0).toUpperCase() + monthShort.slice(1, 3) });
            return acc;
          }, []);

    const yTicksLeft = Array.from({ length: 5 }, (_, i) => {
      const y = bounds.bottom - (height * i) / 4;
      const ratio = i / 4;
      const depositAtY = displayMinDeposit + (displayMaxDeposit - displayMinDeposit) * ratio;
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
  }, [locale, monthBaseByMonth, sortedEntries, trackerView, viewMonth, viewYear]);

  const variantLabel = (variant: Variant | "none") => {
    if (variant === "neg") return locale === "ru" ? "Нарушение ТС" : locale === "uk" ? "Порушення ТС" : "Rule violation";
    if (variant === "pos") return locale === "ru" ? "Следование ТС" : locale === "uk" ? "Дотримання ТС" : "Plan followed";
    if (variant === "pos-outline") {
      return locale === "ru" ? "Дисциплинированный пропуск" : locale === "uk" ? "Дисциплінований пропуск" : "Disciplined skip";
    }
    return locale === "ru" ? "Тип не выбран" : locale === "uk" ? "Тип не обрано" : "No type";
  };

  const getPreviousDayDeposit = useCallback((dateKey: string) => {
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
  }, [dayData]);

  useEffect(() => {
    const inferredMonthBases: Record<string, number> = {};
    const inferredMonthBaseSources: Record<string, MonthBaseSource> = {};
    const monthFirstEntries = new Map<string, { dateKey: string; deposit: number }>();

    sortedEntries.forEach(([dateKey, entry]) => {
      const monthKey = getMonthKey(dateKey);
      const existing = monthFirstEntries.get(monthKey);
      if (!existing || dateKey < existing.dateKey) {
        monthFirstEntries.set(monthKey, { dateKey, deposit: Number(entry.deposit) || 0 });
      }
    });

    monthFirstEntries.forEach((firstEntry, monthKey) => {
      if ((Number(monthBaseByMonth[monthKey]) || 0) > 0) return;
      const previousDeposit = getPreviousDayDeposit(firstEntry.dateKey);
      const inferredBase = previousDeposit > 0 ? previousDeposit : firstEntry.deposit;
      if (inferredBase > 0) {
        inferredMonthBases[monthKey] = inferredBase;
        inferredMonthBaseSources[monthKey] = "inferred";
      }
    });

    if (!Object.keys(inferredMonthBases).length) return;

    setMonthBaseByMonth((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.entries(inferredMonthBases).forEach(([monthKey, value]) => {
        if ((Number(next[monthKey]) || 0) > 0) return;
        next[monthKey] = value;
        changed = true;
      });
      return changed ? next : prev;
    });
    setMonthBaseSourceByMonth((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.entries(inferredMonthBaseSources).forEach(([monthKey, value]) => {
        if (next[monthKey] === "manual" || next[monthKey] === "inferred") return;
        next[monthKey] = value;
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [getPreviousDayDeposit, monthBaseByMonth, sortedEntries]);

  const todayKey = useMemo(() => {
    const nowDate = new Date();
    return formatDateKey(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  }, []);

  const isFutureDateKey = (dateKey: string) => dateKey > todayKey;
  const getMonthBase = (monthKey: string) => Number(monthBaseByMonth[monthKey]) || 0;
  const getMonthBaseSource = (monthKey: string): MonthBaseSource | null => monthBaseSourceByMonth[monthKey] || null;
  const hasEntriesInMonth = useCallback(
    (monthKey: string) => sortedEntries.some(([dateKey]) => getMonthKey(dateKey) === monthKey),
    [sortedEntries]
  );

  const openDayModal = (dateKey: string) => {
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

  const openMonthSetup = (dateKey: string) => {
    const monthKey = getMonthKey(dateKey);
    setMonthSetupDateKey(dateKey);
    setMonthSetupValue(getMonthBase(monthKey) > 0 ? String(Math.round(getMonthBase(monthKey))) : "");
    setMonthSetupError("");
    setMonthSetupOpen(true);
  };

  const openModal = (dateKey: string) => {
    if (isFutureDateKey(dateKey)) {
      setSyncError(ui.futureDayLocked);
      return;
    }
    const monthKey = getMonthKey(dateKey);
    if (!hasEntriesInMonth(monthKey)) {
      openMonthSetup(dateKey);
      return;
    }
    openDayModal(dateKey);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedDateKey("");
    setModalError("");
  };

  const closeMonthSetup = () => {
    setMonthSetupOpen(false);
    setMonthSetupDateKey("");
    setMonthSetupValue("");
    setMonthSetupError("");
  };

  const syncPendingOperation = async (dateKey: string, pending: PendingSync) => {
    const res = await fetch("/api/tracker/entries", {
      method: pending.type === "delete" ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body:
        pending.type === "delete"
          ? JSON.stringify({ dateKey })
          : JSON.stringify({
              dateKey,
              result: pending.entry.result,
              variant: pending.entry.variant,
              deposit: pending.entry.deposit,
              trades: pending.entry.trades,
            }),
    });
    if (!res.ok) {
      throw new Error(`Failed to sync (${res.status})`);
    }
  };

  const retryPendingSyncs = async () => {
    const entries = Object.entries(pendingSyncs);
    if (!entries.length) return;

    const failed: Record<string, PendingSync> = {};
    for (const [dateKey, pending] of entries) {
      try {
        await syncPendingOperation(dateKey, pending);
      } catch {
        failed[dateKey] = pending;
      }
    }

    setPendingSyncs(failed);
    setSyncError(
      Object.keys(failed).length === 0
        ? ""
        : locale === "ru"
          ? "Часть изменений всё ещё не синхронизирована. Повторите попытку."
          : locale === "uk"
            ? "Частину змін усе ще не синхронізовано. Спробуйте ще раз."
            : "Some changes are still not synced. Try again.",
    );
  };

  const saveMonthSetup = () => {
    if (!monthSetupDateKey) return;
    const monthKey = getMonthKey(monthSetupDateKey);
    const enteredMonthBase = Number(monthSetupValue.trim());

    if (monthSetupValue.trim() === "") {
      setMonthSetupError(ui.monthStartDepositRequired);
      return;
    }

    if (!Number.isFinite(enteredMonthBase) || enteredMonthBase <= 0) {
      setMonthSetupError(ui.monthStartDepositPositive);
      return;
    }

    setMonthBaseByMonth((prev) => ({
      ...prev,
      [monthKey]: enteredMonthBase,
    }));
    setMonthBaseSourceByMonth((prev) => ({
      ...prev,
      [monthKey]: "manual",
    }));
    setMonthSetupOpen(false);
    setMonthSetupError("");
    const nextDateKey = monthSetupDateKey;
    setMonthSetupDateKey("");
    openDayModal(nextDateKey);
  };

  const saveDay = async () => {
    if (!selectedDateKey) return;
    if (isFutureDateKey(selectedDateKey)) {
      setModalError(ui.futureDayLocked);
      return;
    }
    const isOutline = modalVariant === "pos-outline";
    const monthKey = getMonthKey(selectedDateKey);
    const existingMonthBase = getMonthBase(monthKey);
    const previousDeposit = isOutline ? getPreviousDayDeposit(selectedDateKey) : 0;
    const enteredDeposit = Number(modalDeposit.trim());
    const outlineDeposit = isOutline ? (previousDeposit > 0 ? previousDeposit : enteredDeposit) : enteredDeposit;
    const deposit = outlineDeposit;
    const trades = isOutline ? 0 : Number(modalTrades.trim());
    const hasVariant = modalVariant === "neg" || modalVariant === "pos" || modalVariant === "pos-outline";
    const hasDeposit = Number.isFinite(deposit) && deposit > 0;
    const hasTrades = Number.isFinite(trades) && (isOutline ? trades >= 0 : trades > 0);
    const hasMonthBase = existingMonthBase > 0;

    if (!hasVariant || !hasDeposit || !hasTrades || !hasMonthBase) {
      if (!hasMonthBase) {
        setModalError(ui.monthSetupRequired);
      } else if (!hasVariant && !hasDeposit && !hasTrades) {
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
    setPendingSyncs((prev) => ({
      ...prev,
      [selectedDateKey]: { type: "upsert", entry: nextEntry },
    }));
    setModalOpen(false);
    setSelectedDateKey("");

    try {
      await syncPendingOperation(selectedDateKey, { type: "upsert", entry: nextEntry });
      setPendingSyncs((prev) => {
        const next = { ...prev };
        delete next[selectedDateKey];
        return next;
      });
      setSyncError("");
    } catch {
      setSyncError(syncFailureMessage("save"));
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
    setPendingSyncs((prev) => ({
      ...prev,
      [selectedDateKey]: { type: "delete" },
    }));
    setModalOpen(false);
    setModalError("");
    setSelectedDateKey("");

    try {
      await syncPendingOperation(selectedDateKey, { type: "delete" });
      setPendingSyncs((prev) => {
        const next = { ...prev };
        delete next[selectedDateKey];
        return next;
      });
      setSyncError("");
    } catch {
      setSyncError(syncFailureMessage("delete"));
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

  const buildMonthCells = useCallback((year: number, month: number) => {
    const first = new Date(year, month, 1);
    const firstDay = (first.getDay() + 6) % 7;
    const lastDate = new Date(year, month + 1, 0).getDate();
    const cells = [] as Array<
      | { kind: "empty" }
      | { kind: "day"; day: number; dateKey: string; entry?: Entry; isSelected: boolean; isFuture: boolean }
    >;

    for (let i = 0; i < 42; i += 1) {
      if (i < firstDay || i >= firstDay + lastDate) {
        cells.push({ kind: "empty" });
      } else {
        const day = i - firstDay + 1;
        const dateKey = formatDateKey(year, month, day);
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
  }, [dayData, selectedDateKey, todayKey]);

  const calendarCells = useMemo(() => {
    return buildMonthCells(viewYear, viewMonth);
  }, [buildMonthCells, viewMonth, viewYear]);

  const yearCalendarMonths = useMemo(() => {
    if (trackerView !== "year") {
      return [];
    }

    const numberLocale = locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US";
    return Array.from({ length: 12 }, (_, month) => {
      const date = new Date(viewYear, month, 1);
      const label = date.toLocaleDateString(numberLocale, { month: "long" });
      return {
        month,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        cells: buildMonthCells(viewYear, month),
      };
    });
  }, [buildMonthCells, locale, trackerView, viewYear]);

  const yearQuarterGroups = useMemo<QuarterGroup[]>(() => {
    if (trackerView !== "year") return [];

    return Array.from({ length: 4 }, (_, quarterIndex) => {
      const startMonth = quarterIndex * 3;
      const months = Array.from({ length: 3 }, (_, offset) => {
        const monthIndex = startMonth + offset;
        return {
          month: monthIndex,
          label: yearCalendarMonths[monthIndex]?.label || yearMonthlyAggregates[monthIndex]?.label || `M${monthIndex + 1}`,
          cells: yearCalendarMonths[monthIndex]?.cells || [],
          aggregate:
            yearMonthlyAggregates[monthIndex] || {
              month: monthIndex,
              label: `M${monthIndex + 1}`,
              trades: 0,
              greenDays: 0,
              redDays: 0,
              filledDays: 0,
              startDeposit: 0,
              endDeposit: 0,
              pnl: 0,
              disciplineScore: 0,
            },
        };
      });

      const trades = months.reduce((sum, month) => sum + month.aggregate.trades, 0);
      const filledDays = months.reduce((sum, month) => sum + month.aggregate.filledDays, 0);
      const pnl = months.reduce((sum, month) => sum + month.aggregate.pnl, 0);
      const disciplinedDays = months.reduce((sum, month) => sum + month.aggregate.greenDays, 0);
      const disciplineScore = filledDays > 0 ? Math.round((disciplinedDays / filledDays) * 100) : 0;

      return {
        key: `q${quarterIndex + 1}`,
        label: `Q${quarterIndex + 1}`,
        months,
        trades,
        filledDays,
        pnl,
        disciplineScore,
      };
    });
  }, [trackerView, yearCalendarMonths, yearMonthlyAggregates]);

  const yearTrendModel = useMemo(() => {
    if (trackerView !== "year") {
      return {
        yellow: "",
        blue: "",
        ticks: [] as Array<{ x: number; label: string }>,
        bounds: { left: 48, right: 1112, top: 28, bottom: 312 },
      };
    }

    const bounds = { left: 48, right: 1112, top: 28, bottom: 312 };
    const values = yearMonthlyAggregates;
    const disciplineValues = values.map((item) => item.disciplineScore);
    const depositValues = values.map((item) => item.filledDays > 0 ? item.endDeposit : item.startDeposit);
    const minDeposit = Math.min(...depositValues, 0);
    const maxDeposit = Math.max(...depositValues, 1);
    const depositRange = Math.max(1, maxDeposit - minDeposit);
    const paddedMinDeposit = minDeposit - depositRange * 0.08;
    const paddedMaxDeposit = maxDeposit + depositRange * 0.08;

    const normalize = (series: number[], min: number, max: number) => {
      if (!series.length) return [];
      const safeRange = max - min || 1;
      return series.map((value) => ((value - min) / safeRange) * 100);
    };

    const yellowValues = normalize(disciplineValues, 0, 100);
    const blueValues = normalize(depositValues, paddedMinDeposit, paddedMaxDeposit);
    const ticks = values.map((item, index) => {
      const steps = values.length > 1 ? values.length - 1 : 1;
      const x = bounds.left + ((bounds.right - bounds.left) * index) / steps;
      return { x, label: item.label };
    });

    return {
      yellow: buildPath(yellowValues, 0, 100, bounds),
      blue: buildPath(blueValues, 0, 100, bounds),
      ticks,
      bounds,
    };
  }, [trackerView, yearMonthlyAggregates]);

  const monthLabel = useMemo(() => {
    const date = new Date(viewYear, viewMonth, 1);
    const title = date.toLocaleDateString(
      locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US",
      { month: "long", year: "numeric" },
    );
    return title.charAt(0).toUpperCase() + title.slice(1);
  }, [locale, viewMonth, viewYear]);

  const shareCopiedMessage =
    locale === "ru"
      ? "Ваша ссылка скопирована в буфер обмена. Поделитесь ей где угодно."
      : locale === "uk"
        ? "Ваше посилання скопійовано в буфер обміну. Поділіться ним будь-де."
        : "Your link has been copied to the clipboard. Share it anywhere.";

  const flashShareCopy = () => {
    setCopyFlash(true);
  };

  const fallbackCopyText = (text: string) => {
    if (typeof document === "undefined") return false;
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    document.body.removeChild(textarea);
    return copied;
  };

  const copyTextToClipboard = async (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall through to execCommand fallback.
      }
    }
    return fallbackCopyText(text);
  };

  const createShare = async () => {
    setShareStatus("");
    setShareLink("");
    setCopyFlash(false);
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
      if (res.status === 401) {
        setShareStatus(ui.sessionExpiredShare);
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            window.location.href = "/login";
          }, 900);
        }
        return;
      }
      if (!res.ok) {
        const errPayload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errPayload?.error || "Failed to create share link");
      }
      const payload = (await res.json()) as { url?: string };
      if (!payload.url) throw new Error("Invalid share response");
      setShareLink(payload.url);
      setShareStatus("");
      return payload.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : locale === "ru" ? "Неизвестная ошибка" : locale === "uk" ? "Невідома помилка" : "Unknown error";
      if (message.toLowerCase().includes("unauthorized")) {
        setShareStatus(ui.sessionExpiredShare);
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            window.location.href = "/login";
          }, 900);
        }
        return;
      }
      setShareStatus(`${locale === "ru" ? "Ошибка" : locale === "uk" ? "Помилка" : "Error"}: ${message}`);
      return null;
    } finally {
      setShareLoading(false);
    }
  };

  const openShareModal = async () => {
    setShareModalOpen(true);
    if (shareLink || shareLoading) return;
    await createShare();
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    const copied = await copyTextToClipboard(shareLink);
    if (copied) {
      setShareStatus(shareCopiedMessage);
      flashShareCopy();
    } else {
      setShareStatus(locale === "ru" ? "Автокопирование не удалось. Скопируйте вручную." : locale === "uk" ? "Автокопіювання не вдалося. Скопіюйте вручну." : "Auto-copy failed. Copy it manually.");
    }
  };

  const outlinePreviousDeposit = selectedDateKey ? getPreviousDayDeposit(selectedDateKey) : 0;
  const outlineNeedsManualDeposit = modalVariant === "pos-outline" && outlinePreviousDeposit <= 0;
  const helpOpen = (key: string) => isTouchMode && activeHelpKey === key;

  const toggleHelp = (key: string) => {
    if (!isTouchMode) return;
    setActiveHelpKey((prev) => (prev === key ? null : key));
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && shareModalOpen) {
        setCopyFlash(false);
        setShareModalOpen(false);
        return;
      }
      if (event.key === "Escape" && monthSetupOpen) {
        setMonthSetupOpen(false);
        setMonthSetupDateKey("");
        setMonthSetupValue("");
        setMonthSetupError("");
        return;
      }
      if (event.key === "Escape" && modalOpen) {
        setModalOpen(false);
        setSelectedDateKey("");
        setModalError("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalOpen, monthSetupOpen, shareModalOpen]);

  const formatUsdValue = (value: number, signed = false) => {
    const numberLocale = locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US";
    const rounded = Math.round(Math.abs(value));
    if (signed) {
      const sign = value >= 0 ? "+" : "-";
      return `${sign}${rounded.toLocaleString(numberLocale)}$`;
    }
    return `${rounded.toLocaleString(numberLocale)}$`;
  };
  const formatChartDate = (dateKey: string) => {
    const date = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateKey;
    return date.toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <section className={styles.wrapper}>
      <div className={styles.tracker}>
        <div className={`${styles.panel} ${styles.mainPanel}`}>
          <div className={styles.head}>
            <div className={styles.trackerHeadRow}>
              <h2>{trackerView === "month" ? ui.monthTracker : ui.yearTracker}</h2>
              <div className={styles.trackerHeadActions}>
                {trackerView === "month" ? (
                  <div className={styles.shareHead}>
                    <button
                      type="button"
                      className={`${styles.shareIconBtn} ${copyFlash ? styles.copyOk : ""}`}
                      onClick={openShareModal}
                      disabled={shareLoading}
                      aria-label={ui.shareSequence}
                      title={ui.shareSequence}
                    >
                      {shareLoading ? (
                        <span className={styles.shareIconGlyph}>…</span>
                      ) : (
                        <Image src="/share-icon.svg" alt="" aria-hidden width={18} height={18} className={styles.shareIconSvg} />
                      )}
                    </button>
                  </div>
                ) : null}
                <div className={styles.trackerScopeToggle} role="tablist" aria-label="Tracker scope">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={trackerView === "month"}
                    className={`${styles.trackerScopeBtn} ${trackerView === "month" ? styles.trackerScopeBtnActive : ""}`}
                    onClick={() => setTrackerView("month")}
                  >
                    {ui.trackerMonth}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={trackerView === "year"}
                    className={`${styles.trackerScopeBtn} ${trackerView === "year" ? styles.trackerScopeBtnActive : ""}`}
                    onClick={() => setTrackerView("year")}
                  >
                    {ui.trackerYear}
                  </button>
                </div>
              </div>
            </div>
            {syncError || pendingSyncCount > 0 ? (
              <div className={styles.syncState}>
                {syncError ? <p className={styles.syncError}>{syncError}</p> : null}
                {pendingSyncCount > 0 ? (
                  <div className={styles.syncPendingRow}>
                    <span className={styles.syncPendingText}>{trackerSyncStatusText}</span>
                    <button className={`btn ${styles.syncRetryBtn}`} type="button" onClick={retryPendingSyncs}>
                      {locale === "ru" ? "Повторить sync" : locale === "uk" ? "Повторити sync" : "Retry sync"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
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
              aria-label={trackerView === "month" ? ui.monthTracker : ui.yearTracker}
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
                        label: bar.label,
                        dateKey: bar.dateKey,
                        pnl: bar.pnl,
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
                <div>{ui.day}: {formatChartDate(chartHover.dateKey)}</div>
                <div>{ui.type}: {variantLabel(chartHover.variant)}</div>
                <div>{ui.trades}: {chartHover.trades}</div>
                <div>PnL: {formatUsdValue(chartHover.pnl, true)}</div>
              </div>
            ) : null}
          </div>

          <div className={styles.scoreRow}>
            <div
              className={`${styles.score} ${styles.scoreBlue}`}
              onClick={() => toggleHelp("score-discipline")}
              role={isTouchMode ? "button" : undefined}
              tabIndex={isTouchMode ? 0 : undefined}
            >
              <div className={styles.scoreLabel}>
                <span>{ui.disciplineScore}</span>
              </div>
              <strong>{stats.score}%</strong>
              <span className={`${styles.scoreTooltip} ${helpOpen("score-discipline") ? styles.scoreTooltipVisible : ""}`}>{ui.disciplineScoreHint}</span>
            </div>
            <div
              className={`${styles.score} ${styles.scoreGreen}`}
              onClick={() => toggleHelp("score-green-streak")}
              role={isTouchMode ? "button" : undefined}
              tabIndex={isTouchMode ? 0 : undefined}
            >
              <div className={styles.scoreLabel}>
                <span>{ui.greenStreak}</span>
              </div>
              <strong>{stats.greenStreak}</strong>
              <span className={`${styles.scoreTooltip} ${helpOpen("score-green-streak") ? styles.scoreTooltipVisible : ""}`}>{ui.greenStreakHint}</span>
            </div>
            <div
              className={`${styles.score} ${styles.scoreRed}`}
              onClick={() => toggleHelp("score-red-streak")}
              role={isTouchMode ? "button" : undefined}
              tabIndex={isTouchMode ? 0 : undefined}
            >
              <div className={styles.scoreLabel}>
                <span>{ui.redStreak}</span>
              </div>
              <strong>{stats.redStreak}</strong>
              <span className={`${styles.scoreTooltip} ${helpOpen("score-red-streak") ? styles.scoreTooltipVisible : ""}`}>{ui.redStreakHint}</span>
            </div>
          </div>

        </div>

        <div className={styles.side}>
          {trackerView === "month" ? (
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
                    return <button key={`empty-${index}`} className={`${styles.day} ${styles.dayEmpty}`} type="button" />;
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
          ) : (
            <div className={`${styles.panel} ${styles.yearOverviewPanel}`}>
              <div className={styles.yearOverviewHead}>
                <h3>{ui.yearOverview}</h3>
                <div className={styles.yearOverviewNav}>
                  <button type="button" className={styles.arrow} aria-label="Previous year" onClick={() => setViewYear((y) => y - 1)}>
                    ‹
                  </button>
                  <strong>{viewYear}</strong>
                  <button type="button" className={styles.arrow} aria-label="Next year" onClick={() => setViewYear((y) => y + 1)}>
                    ›
                  </button>
                </div>
              </div>
              <div className={styles.yearOverviewStats}>
                <div className={styles.yearOverviewItem}>
                  <span>{ui.endBalance}</span>
                  <strong>{formatUsdValue(yearOverview.endingBalance)}</strong>
                </div>
                <div className={styles.yearOverviewItem}>
                  <span>{ui.tradingDays}</span>
                  <strong>{yearOverview.totalFilledDays}</strong>
                </div>
                <div className={styles.yearOverviewItem}>
                  <span>{ui.avgTradesDay}</span>
                  <strong>{yearOverview.avgTradesDay}</strong>
                </div>
                <div className={styles.yearOverviewItem}>
                  <span>{ui.filledMonths}</span>
                  <strong>{yearOverview.activeMonths}</strong>
                </div>
              </div>
              <div className={styles.yearHighlightList}>
                <div className={styles.yearHighlightItem}>
                  <span>{ui.bestMonth}</span>
                  <strong>{yearOverview.bestMonth ? `${yearOverview.bestMonth.label} · ${formatUsdValue(yearOverview.bestMonth.pnl, true)}` : "—"}</strong>
                </div>
                <div className={styles.yearHighlightItem}>
                  <span>{ui.worstMonth}</span>
                  <strong>{yearOverview.worstMonth ? `${yearOverview.worstMonth.label} · ${formatUsdValue(yearOverview.worstMonth.pnl, true)}` : "—"}</strong>
                </div>
              </div>
            </div>
          )}

          <div className={`${styles.panel} ${styles.ai}`}>
            <h4>
              <Image className={styles.aiIcon} src="/Group.svg" alt="" aria-hidden width={28} height={28} /> {ui.aiAdvice}
            </h4>
            <p>{adviceSnapshot?.advice || aiLiveAdvice}</p>
          </div>
        </div>
      </div>

      {trackerView === "month" ? (
        <>
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
                {signalizer.items.map((item) => (
                  <div key={`${item.level}-${item.label}`} className={styles.signalItem}>
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
                <h4>{reviewTitle}</h4>
              </div>
              <div className={styles.weeklyGrid}>
                <div className={styles.weeklyItem}>
                  <div className={styles.metricLabel}>
                    <span>{ui.totalTrades}</span>
                    <button
                      type="button"
                      className={styles.metricHelp}
                      aria-label={ui.totalTradesHint}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHelp("review-total-trades");
                      }}
                    >
                      ?
                      <span className={`${styles.metricTooltip} ${helpOpen("review-total-trades") ? styles.metricTooltipVisible : ""}`}>{ui.totalTradesHint}</span>
                    </button>
                  </div>
                  <strong>{periodReview.totalTrades}</strong>
                </div>
                <div className={styles.weeklyItem}>
                  <div className={styles.metricLabel}>
                    <span>{ui.avgTrades}</span>
                    <button
                      type="button"
                      className={styles.metricHelp}
                      aria-label={ui.avgTradesHint}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHelp("review-avg-trades");
                      }}
                    >
                      ?
                      <span className={`${styles.metricTooltip} ${helpOpen("review-avg-trades") ? styles.metricTooltipVisible : ""}`}>{ui.avgTradesHint}</span>
                    </button>
                  </div>
                  <strong>{periodReview.avgTrades}</strong>
                </div>
                <div className={styles.weeklyItem}>
                  <div className={styles.metricLabel}>
                    <span>{ui.greenPnlSum}</span>
                    <button
                      type="button"
                      className={styles.metricHelp}
                      aria-label={ui.greenPnlSumHint}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHelp("review-green-pnl");
                      }}
                    >
                      ?
                      <span className={`${styles.metricTooltip} ${helpOpen("review-green-pnl") ? styles.metricTooltipVisible : ""}`}>{ui.greenPnlSumHint}</span>
                    </button>
                  </div>
                  <strong>{periodReview.greenPnlSum}</strong>
                </div>
                <div className={styles.weeklyItem}>
                  <div className={styles.metricLabel}>
                    <span>{ui.redPnlSum}</span>
                    <button
                      type="button"
                      className={styles.metricHelp}
                      aria-label={ui.redPnlSumHint}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHelp("review-red-pnl");
                      }}
                    >
                      ?
                      <span className={`${styles.metricTooltip} ${helpOpen("review-red-pnl") ? styles.metricTooltipVisible : ""}`}>{ui.redPnlSumHint}</span>
                    </button>
                  </div>
                  <strong>{periodReview.redPnlSum}</strong>
                </div>
                <div className={styles.weeklyItem}>
                  <div className={styles.metricLabel}>
                    <span>{ui.maxDrawdown}</span>
                    <button
                      type="button"
                      className={styles.metricHelp}
                      aria-label={ui.maxDrawdownHint}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHelp("review-max-dd");
                      }}
                    >
                      ?
                      <span className={`${styles.metricTooltip} ${helpOpen("review-max-dd") ? styles.metricTooltipVisible : ""}`}>{ui.maxDrawdownHint}</span>
                    </button>
                  </div>
                  <strong>{periodReview.maxDrawdown}</strong>
                </div>
                <div className={styles.weeklyItem}>
                  <div className={styles.metricLabel}>
                    <span>{ui.netPnl}</span>
                    <button
                      type="button"
                      className={styles.metricHelp}
                      aria-label={ui.netPnlHint}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHelp("review-net-pnl");
                      }}
                    >
                      ?
                      <span className={`${styles.metricTooltip} ${helpOpen("review-net-pnl") ? styles.metricTooltipVisible : ""}`}>{ui.netPnlHint}</span>
                    </button>
                  </div>
                  <strong>{periodReview.netPnl}</strong>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className={styles.yearRow}>
          <div className={styles.yearQuarterGrid}>
            {yearQuarterGroups.map((quarter) => (
              <section key={quarter.key} className={`${styles.panel} ${styles.yearQuarterPanel}`}>
                <div className={styles.yearQuarterHead}>
                  <div>
                    <span className={styles.yearQuarterEyebrow}>{quarter.label}</span>
                    <h4>{`${quarter.months[0]?.label} - ${quarter.months[quarter.months.length - 1]?.label}`}</h4>
                  </div>
                  <div className={styles.yearQuarterSummary}>
                    <span>{quarter.disciplineScore}%</span>
                    <span>{quarter.trades} / {quarter.filledDays}</span>
                    <strong>{formatUsdValue(quarter.pnl, true)}</strong>
                  </div>
                </div>
                <div className={styles.yearQuarterMonths}>
                  {quarter.months.map((month) => (
                    <div key={month.month} className={styles.yearMonthCard}>
                      <div className={styles.yearMonthHead}>
                        <h5>{month.label}</h5>
                        <span>{month.aggregate.disciplineScore}%</span>
                      </div>
                      <div className={styles.yearWeekdays}>
                        <span>{ui.mon}</span>
                        <span>{ui.tue}</span>
                        <span>{ui.wed}</span>
                        <span>{ui.thu}</span>
                        <span>{ui.fri}</span>
                        <span>{ui.sat}</span>
                        <span>{ui.sun}</span>
                      </div>
                      <div className={styles.yearMonthDays}>
                        {month.cells.map((cell, index) =>
                          cell.kind === "empty" ? (
                            <button key={`y-empty-${month.month}-${index}`} className={`${styles.yearDay} ${styles.dayEmpty}`} type="button" />
                          ) : (
                            <button
                              key={cell.dateKey}
                              type="button"
                              className={`${renderDayClass(cell.entry, cell.isSelected)} ${styles.yearDay} ${cell.isFuture ? styles.dayLocked : ""}`}
                              onClick={() => openModal(cell.dateKey)}
                              disabled={cell.isFuture}
                              aria-disabled={cell.isFuture}
                            >
                              {cell.day}
                            </button>
                          ),
                        )}
                      </div>
                      <div className={styles.yearMonthMeta}>
                        <span>{month.aggregate.trades}t</span>
                        <strong>{formatUsdValue(month.aggregate.pnl, true)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className={`${styles.panel} ${styles.yearTrendPanel}`}>
            <div className={styles.yearTrendHead}>
              <div>
                <span className={styles.yearQuarterEyebrow}>{reviewTitle}</span>
                <h4>{ui.yearOverview}</h4>
              </div>
              <div className={styles.yearTrendLegend}>
                <span className={styles.legendItem}>
                  <i className={`${styles.legendLine} ${styles.legendYellow}`} /> {ui.consistency}
                </span>
                <span className={styles.legendItem}>
                  <i className={`${styles.legendLine} ${styles.legendBlue}`} /> {ui.depositSize}
                </span>
              </div>
            </div>
            <div className={styles.yearTrendLayout}>
              <div className={styles.yearTrendChartWrap}>
                <svg className={styles.yearTrendChart} viewBox="0 0 1160 340" preserveAspectRatio="none" aria-label={ui.yearlyReview}>
                  <g>
                    {[28, 99, 170, 241, 312].map((y, index) => (
                      <line key={`year-trend-grid-${index}`} className={styles.gridLine} x1={yearTrendModel.bounds.left} y1={y} x2={yearTrendModel.bounds.right} y2={y} />
                    ))}
                  </g>
                  <path className={styles.yellowGlow} d={yearTrendModel.yellow} />
                  <path className={styles.blueGlow} d={yearTrendModel.blue} />
                  <path className={`${styles.line} ${styles.yellow}`} d={yearTrendModel.yellow} />
                  <path className={`${styles.line} ${styles.blue}`} d={yearTrendModel.blue} />
                  {yearTrendModel.ticks.map((tick) => (
                    <text key={`year-trend-tick-${tick.label}`} className={styles.tickLabel} x={tick.x} y={334} textAnchor="middle">
                      {tick.label}
                    </text>
                  ))}
                </svg>
              </div>
              <div className={styles.yearMetaColumn}>
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
                    <h4>{reviewTitle}</h4>
                  </div>
                  <div className={styles.weeklyGrid}>
                    <div className={styles.weeklyItem}>
                      <span>{ui.totalTrades}</span>
                      <strong>{periodReview.totalTrades}</strong>
                    </div>
                    <div className={styles.weeklyItem}>
                      <span>{ui.avgTradesDay}</span>
                      <strong>{yearOverview.avgTradesDay}</strong>
                    </div>
                    <div className={styles.weeklyItem}>
                      <span>{ui.greenPnlSum}</span>
                      <strong>{periodReview.greenPnlSum}</strong>
                    </div>
                    <div className={styles.weeklyItem}>
                      <span>{ui.redPnlSum}</span>
                      <strong>{periodReview.redPnlSum}</strong>
                    </div>
                    <div className={styles.weeklyItem}>
                      <span>{ui.avgErrorCost}</span>
                      <strong>{periodReview.avgErrorCost}</strong>
                    </div>
                    <div className={styles.weeklyItem}>
                      <span>{ui.maxDrawdown}</span>
                      <strong>{periodReview.maxDrawdown}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {shareModalOpen ? (
        <div
          className={styles.shareModalBackdrop}
          onClick={() => {
            setCopyFlash(false);
            setShareModalOpen(false);
          }}
          role="presentation"
        >
          <div className={styles.shareModal} role="dialog" aria-modal="true" aria-labelledby="tracker-share-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className={styles.shareModalHeader}>
              <div>
                <h3 id="tracker-share-modal-title">{ui.sharePopupTitle}</h3>
                <p>{ui.sharePopupHint}</p>
              </div>
              <button
                type="button"
                className={styles.shareModalClose}
                onClick={() => {
                  setCopyFlash(false);
                  setShareModalOpen(false);
                }}
                aria-label={ui.close}
              >
                ×
              </button>
            </div>
            <div className={styles.shareModalRow}>
              <input
                className={styles.shareModalInput}
                type="text"
                value={shareLink}
                readOnly
                placeholder={shareLoading ? ui.creating : ""}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className={`${styles.shareModalCopyBtn} ${copyFlash ? styles.shareModalCopyBtnOk : ""}`}
                onClick={copyShareLink}
                disabled={shareLoading || !shareLink}
              >
                {copyFlash ? ui.copied : ui.copy}
              </button>
            </div>
            {shareStatus ? <p className={styles.shareModalStatus}>{shareStatus}</p> : null}
          </div>
        </div>
      ) : null}

      {monthSetupOpen ? (
        <div className={styles.modalBackdrop} onClick={closeMonthSetup} role="presentation">
          <div className={`${styles.modal} ${styles.monthSetupModal}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{ui.monthSetupTitle}</h3>
            <p className={styles.modalDate}>{ui.monthSetupDescription}</p>

            <label className={`${styles.field} ${styles.fieldPrimary}`}>
              <span>{ui.monthStartDeposit}</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={ui.enterMonthStartDeposit}
                value={monthSetupValue}
                autoFocus
                onChange={(e) => {
                  setMonthSetupValue(e.target.value.replace(/\D/g, ""));
                  setMonthSetupError("");
                }}
              />
              <small className={styles.fieldHint}>{ui.monthStartDepositHint}</small>
            </label>

            {monthSetupError ? <p className={styles.modalError}>{monthSetupError}</p> : null}

            <div className={styles.monthSetupActions}>
              <button className="btn" type="button" onClick={closeMonthSetup}>
                {ui.cancel}
              </button>
              <button className="btn primary" type="button" onClick={saveMonthSetup}>
                {ui.continueCta}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className={styles.modalBackdrop} onClick={closeModal} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{ui.daySettings}</h3>
            <p className={styles.modalDate}>{selectedDateKey}</p>
            {selectedDateKey ? (
              <div className={`${styles.field} ${styles.fieldPrimary}`}>
                <span>{ui.monthStartDeposit}</span>
                <div className={styles.fieldValue}>
                  {getMonthBase(getMonthKey(selectedDateKey)).toLocaleString(locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US")}
                </div>
                <small className={styles.fieldHint}>
                  {ui.monthStartDepositHint}{" "}
                  {getMonthBaseSource(getMonthKey(selectedDateKey)) === "inferred" ? ui.monthBaseInferredHint : ui.monthBaseManualHint}
                </small>
              </div>
            ) : null}

            <label className={styles.field}>
              <div className={styles.fieldHeader}>
                <span>{ui.result}</span>
                <button
                  type="button"
                  className={styles.metricHelp}
                  aria-label={ui.dayGuideTitle}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHelp("modal-day-guide");
                  }}
                >
                  ?
                  <span className={`${styles.metricTooltip} ${helpOpen("modal-day-guide") ? styles.metricTooltipVisible : ""}`}>
                    <strong>{ui.dayGuideTitle}</strong>
                    <br />
                    {ui.dayGuideGreen}
                    <br />
                    {ui.dayGuideRed}
                    <br />
                    {ui.dayGuideOutline}
                  </span>
                </button>
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
                <button
                  type="button"
                  className={styles.metricHelp}
                  aria-label={ui.depositGuideTitle}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHelp("modal-deposit-guide");
                  }}
                >
                  ?
                  <span className={`${styles.metricTooltip} ${helpOpen("modal-deposit-guide") ? styles.metricTooltipVisible : ""}`}>
                    <strong>{ui.depositGuideTitle}</strong>
                    <br />
                    {ui.depositGuideText}
                    <br />
                    {ui.depositGuideHint}
                  </span>
                </button>
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
