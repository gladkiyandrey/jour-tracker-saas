"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./SettingsClient.module.css";

type Props = {
  userKey: string;
  locale: Locale;
  initialTimezone: string;
  initialStartDeposit: number;
};

type UserSettings = {
  startDeposit: string;
  maxTradesPerDay: string;
  timezone: string;
  disciplineMode: "strict" | "balanced" | "soft";
  riskAlerts: boolean;
  regressionAlerts: boolean;
  copyShareLink: boolean;
};

const defaults: UserSettings = {
  startDeposit: "10000",
  maxTradesPerDay: "2",
  timezone: "UTC",
  disciplineMode: "balanced",
  riskAlerts: true,
  regressionAlerts: true,
  copyShareLink: true,
};

function base64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64Safe);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export default function SettingsClient({ userKey, locale, initialTimezone, initialStartDeposit }: Props) {
  const storageKey = `consist-user-settings-${userKey}`;
  const [state, setState] = useState<UserSettings>({
    ...defaults,
    timezone: initialTimezone || defaults.timezone,
    startDeposit: String(initialStartDeposit || Number(defaults.startDeposit)),
  });
  const [savedAt, setSavedAt] = useState("");
  const [saveError, setSaveError] = useState("");

  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState("");

  const txt = useMemo(() => {
    if (locale === "ru") {
      return {
        tradingRules: "Торговые правила",
        ruleHelp: "Базовые лимиты для личного режима торговли.",
        startDeposit: "Стартовый депозит ($)",
        maxTrades: "Макс. сделок/день",
        timezone: "Часовой пояс",
        timezoneHelp: "Используется для корректного времени сделок и графиков.",
        disciplineMode: "Режим дисциплины",
        strict: "Строгий",
        balanced: "Сбалансированный",
        soft: "Мягкий",
        notifications: "Уведомления",
        notifHelp: "Контроль рисков и возврат пользователей.",
        riskAlerts: "Риск-сигналы (тильт / дивергенция)",
        regressionAlerts: "Предупреждения о регрессии",
        copyShare: "Автокопирование share-ссылки",
        browserPush: "Browser Push",
        pushEnable: "Включить push",
        pushDisable: "Отключить push",
        pushTest: "Тест push",
        pushDenied: "Браузер заблокировал уведомления. Разреши их в настройках сайта.",
        pushUnavailable: "Push не поддерживается этим браузером.",
        pushOn: "Push включен",
        pushOff: "Push выключен",
        saveSettings: "Сохранить настройки",
        savedAt: "Сохранено в",
        nextTitle: "Рекомендуемые следующие настройки",
        n1: "Часовой пояс + время окончания торгового дня",
        n2: "Жесткий дневной лимит потерь и лимит красных дней подряд",
        n3: "Теги ошибок по умолчанию (FOMO, Revenge, Overtrade, Late Entry)",
        n4: "Частота AI-советов (ежедневно / раз в 3 дня / еженедельно)",
        n5: "Приватность share-карточек (публично / анонимно)",
      };
    }
    if (locale === "uk") {
      return {
        tradingRules: "Торгові правила",
        ruleHelp: "Базові ліміти для особистого режиму торгівлі.",
        startDeposit: "Стартовий депозит ($)",
        maxTrades: "Макс. угод/день",
        timezone: "Часовий пояс",
        timezoneHelp: "Використовується для коректного часу угод і графіків.",
        disciplineMode: "Режим дисципліни",
        strict: "Строгий",
        balanced: "Збалансований",
        soft: "М'який",
        notifications: "Сповіщення",
        notifHelp: "Контроль ризиків і повернення користувачів.",
        riskAlerts: "Ризик-сигнали (тільт / дивергенція)",
        regressionAlerts: "Попередження про регресію",
        copyShare: "Автокопіювання share-посилання",
        browserPush: "Browser Push",
        pushEnable: "Увімкнути push",
        pushDisable: "Вимкнути push",
        pushTest: "Тест push",
        pushDenied: "Браузер заблокував сповіщення. Дозволь їх у налаштуваннях сайту.",
        pushUnavailable: "Push не підтримується цим браузером.",
        pushOn: "Push увімкнено",
        pushOff: "Push вимкнено",
        saveSettings: "Зберегти налаштування",
        savedAt: "Збережено о",
        nextTitle: "Рекомендовані наступні налаштування",
        n1: "Часовий пояс + час завершення торгового дня",
        n2: "Жорсткий денний ліміт втрат і ліміт червоних днів підряд",
        n3: "Теги помилок за замовчуванням (FOMO, Revenge, Overtrade, Late Entry)",
        n4: "Частота AI-порад (щодня / раз на 3 дні / щотижня)",
        n5: "Приватність share-карток (публічно / анонімно)",
      };
    }
    return {
      tradingRules: "Trading Rules",
      ruleHelp: "Basic limits used for your personal workflow.",
      startDeposit: "Start deposit ($)",
      maxTrades: "Max trades/day",
      timezone: "Time zone",
      timezoneHelp: "Used to interpret trade times and build the chart correctly.",
      disciplineMode: "Discipline mode",
      strict: "Strict",
      balanced: "Balanced",
      soft: "Soft",
      notifications: "Notifications",
      notifHelp: "Control risk alerts and return engagement.",
      riskAlerts: "Risk alerts (tilt / divergence)",
      regressionAlerts: "Regression warnings",
      copyShare: "Auto copy share link",
      browserPush: "Browser Push",
      pushEnable: "Enable push",
      pushDisable: "Disable push",
      pushTest: "Test push",
      pushDenied: "Browser notifications are blocked. Allow notifications in site settings.",
      pushUnavailable: "Push is not supported by this browser.",
      pushOn: "Push enabled",
      pushOff: "Push disabled",
      saveSettings: "Save settings",
      savedAt: "Saved at",
      nextTitle: "Recommended next settings",
      n1: "Timezone + day cutoff hour (for correct daily stats)",
      n2: "Hard daily loss limit and max red days in a row",
      n3: "Default day tags (FOMO, Revenge, Overtrade, Late Entry)",
      n4: "AI advice frequency (daily / every 3 days / weekly)",
      n5: "Privacy options for shared cards (public / anonymized)",
    };
  }, [locale]);

  const timeZoneOptions = useMemo(() => {
    const browserZone =
      typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";
    const supported =
      typeof Intl !== "undefined" && "supportedValuesOf" in Intl
        ? (Intl.supportedValuesOf("timeZone") as string[])
        : ["UTC"];
    const merged = Array.from(new Set(["UTC", browserZone, initialTimezone, ...supported].filter(Boolean)));
    return merged.sort((a, b) => a.localeCompare(b, "en"));
  }, [initialTimezone]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      setState({
        startDeposit: parsed.startDeposit ?? defaults.startDeposit,
        maxTradesPerDay: parsed.maxTradesPerDay ?? defaults.maxTradesPerDay,
        timezone: typeof parsed.timezone === "string" && parsed.timezone ? parsed.timezone : initialTimezone || defaults.timezone,
        disciplineMode:
          parsed.disciplineMode === "strict" || parsed.disciplineMode === "balanced" || parsed.disciplineMode === "soft"
            ? parsed.disciplineMode
            : defaults.disciplineMode,
        riskAlerts: typeof parsed.riskAlerts === "boolean" ? parsed.riskAlerts : defaults.riskAlerts,
        regressionAlerts:
          typeof parsed.regressionAlerts === "boolean" ? parsed.regressionAlerts : defaults.regressionAlerts,
        copyShareLink: typeof parsed.copyShareLink === "boolean" ? parsed.copyShareLink : defaults.copyShareLink,
      });
    } catch {
      // ignore parse errors
    }
  }, [initialStartDeposit, initialTimezone, storageKey]);

  useEffect(() => {
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setPushSupported(supported);
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!pushSupported) return;
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setPushEnabled(Boolean(sub));
      } catch {
        if (!cancelled) setPushEnabled(false);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [pushSupported]);

  const save = async () => {
    setSaveError("");
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: state.timezone, startDeposit: Number(state.startDeposit) }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to save settings");
      }
      setSavedAt(new Date().toLocaleTimeString(locale === "uk" ? "uk-UA" : locale === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setSavedAt("");
      setSaveError("save failed");
    }
  };

  const enablePush = async () => {
    if (!pushSupported) {
      setPushMsg(txt.pushUnavailable);
      return;
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublic) {
      setPushMsg("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY in Vercel env.");
      return;
    }

    setPushBusy(true);
    setPushMsg("");
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== "granted") {
        setPushMsg(txt.pushDenied);
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(vapidPublic),
        }));

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      setPushEnabled(true);
      setPushMsg(txt.pushOn);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push error";
      setPushMsg(message);
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushBusy(true);
    setPushMsg("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setPushEnabled(false);
      setPushMsg(txt.pushOff);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push error";
      setPushMsg(message);
    } finally {
      setPushBusy(false);
    }
  };

  const sendTestPush = async () => {
    setPushBusy(true);
    setPushMsg("");
    try {
      const res = await fetch("/api/push/send-test", { method: "POST" });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; sent?: number };
      if (!res.ok) {
        setPushMsg(payload.error || "Test push failed");
        return;
      }
      setPushMsg(`OK: ${payload.sent ?? 0}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push error";
      setPushMsg(message);
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <section className={styles.wrap}>
      <div className={styles.grid}>
        <article className={styles.card}>
          <h3>{txt.tradingRules}</h3>
          <p>{txt.ruleHelp}</p>
          <div className={styles.row}>
            <label className={styles.label}>
              {txt.startDeposit}
              <input
                className={styles.input}
                type="text"
                inputMode="numeric"
                value={state.startDeposit}
                onChange={(e) => setState((prev) => ({ ...prev, startDeposit: e.target.value.replace(/\D/g, "") }))}
              />
            </label>
            <label className={styles.label}>
              {txt.maxTrades}
              <input
                className={styles.input}
                type="text"
                inputMode="numeric"
                value={state.maxTradesPerDay}
                onChange={(e) => setState((prev) => ({ ...prev, maxTradesPerDay: e.target.value.replace(/\D/g, "") }))}
              />
            </label>
            <label className={styles.label}>
              {txt.timezone}
              <select
                className={styles.select}
                value={state.timezone}
                onChange={(e) => setState((prev) => ({ ...prev, timezone: e.target.value }))}
              >
                {timeZoneOptions.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              <span className={styles.hint}>{txt.timezoneHelp}</span>
            </label>
            <label className={styles.label}>
              {txt.disciplineMode}
              <select
                className={styles.select}
                value={state.disciplineMode}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    disciplineMode: (e.target.value as UserSettings["disciplineMode"]) || "balanced",
                  }))
                }
              >
                <option value="strict">{txt.strict}</option>
                <option value="balanced">{txt.balanced}</option>
                <option value="soft">{txt.soft}</option>
              </select>
            </label>
          </div>
        </article>

        <article className={styles.card}>
          <h3>{txt.notifications}</h3>
          <p>{txt.notifHelp}</p>
          <div className={styles.row}>
            <label className={styles.switch}>
              {txt.riskAlerts}
              <input
                type="checkbox"
                checked={state.riskAlerts}
                onChange={(e) => setState((prev) => ({ ...prev, riskAlerts: e.target.checked }))}
              />
            </label>
            <label className={styles.switch}>
              {txt.regressionAlerts}
              <input
                type="checkbox"
                checked={state.regressionAlerts}
                onChange={(e) => setState((prev) => ({ ...prev, regressionAlerts: e.target.checked }))}
              />
            </label>
            <label className={styles.switch}>
              {txt.copyShare}
              <input
                type="checkbox"
                checked={state.copyShareLink}
                onChange={(e) => setState((prev) => ({ ...prev, copyShareLink: e.target.checked }))}
              />
            </label>
          </div>

          <div className={styles.pushBox}>
            <div className={styles.pushHead}>
              <strong>{txt.browserPush}</strong>
              <span>{pushPermission}</span>
            </div>
            <div className={styles.pushActions}>
              <button className="btn" type="button" disabled={pushBusy || !pushSupported} onClick={enablePush}>
                {txt.pushEnable}
              </button>
              <button className="btn" type="button" disabled={pushBusy || !pushSupported} onClick={disablePush}>
                {txt.pushDisable}
              </button>
              <button className="btn" type="button" disabled={pushBusy || !pushSupported || !pushEnabled} onClick={sendTestPush}>
                {txt.pushTest}
              </button>
            </div>
            {pushMsg ? <p className={styles.pushMsg}>{pushMsg}</p> : null}
          </div>
        </article>
      </div>

      <div className={styles.actions}>
        <button className="btn primary" type="button" onClick={save}>
          {txt.saveSettings}
        </button>
        {savedAt ? <p className={styles.saved}>{txt.savedAt} {savedAt}</p> : null}
        {saveError ? <p className={styles.error}>{saveError}</p> : null}
      </div>

      <article className={styles.tips}>
        <h3>{txt.nextTitle}</h3>
        <ul>
          <li>{txt.n1}</li>
          <li>{txt.n2}</li>
          <li>{txt.n3}</li>
          <li>{txt.n4}</li>
          <li>{txt.n5}</li>
        </ul>
      </article>
    </section>
  );
}
