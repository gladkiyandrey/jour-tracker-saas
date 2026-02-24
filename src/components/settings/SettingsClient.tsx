"use client";

import { useEffect, useState } from "react";
import styles from "./SettingsClient.module.css";

type Props = {
  userKey: string;
};

type UserSettings = {
  startDeposit: string;
  maxTradesPerDay: string;
  disciplineMode: "strict" | "balanced" | "soft";
  riskAlerts: boolean;
  regressionAlerts: boolean;
  copyShareLink: boolean;
};

const defaults: UserSettings = {
  startDeposit: "10000",
  maxTradesPerDay: "2",
  disciplineMode: "balanced",
  riskAlerts: true,
  regressionAlerts: true,
  copyShareLink: true,
};

export default function SettingsClient({ userKey }: Props) {
  const storageKey = `consist-user-settings-${userKey}`;
  const [state, setState] = useState<UserSettings>(defaults);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      setState({
        startDeposit: parsed.startDeposit ?? defaults.startDeposit,
        maxTradesPerDay: parsed.maxTradesPerDay ?? defaults.maxTradesPerDay,
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
  }, [storageKey]);

  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setSavedAt("save failed");
    }
  };

  return (
    <section className={styles.wrap}>
      <div className={styles.grid}>
        <article className={styles.card}>
          <h3>Trading Rules</h3>
          <p>Basic limits used for your personal workflow.</p>
          <div className={styles.row}>
            <label className={styles.label}>
              Start deposit ($)
              <input
                className={styles.input}
                type="text"
                inputMode="numeric"
                value={state.startDeposit}
                onChange={(e) => setState((prev) => ({ ...prev, startDeposit: e.target.value.replace(/\D/g, "") }))}
              />
            </label>
            <label className={styles.label}>
              Max trades/day
              <input
                className={styles.input}
                type="text"
                inputMode="numeric"
                value={state.maxTradesPerDay}
                onChange={(e) => setState((prev) => ({ ...prev, maxTradesPerDay: e.target.value.replace(/\D/g, "") }))}
              />
            </label>
            <label className={styles.label}>
              Discipline mode
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
                <option value="strict">Strict</option>
                <option value="balanced">Balanced</option>
                <option value="soft">Soft</option>
              </select>
            </label>
          </div>
        </article>

        <article className={styles.card}>
          <h3>Notifications</h3>
          <p>Control risk and behavior alerts.</p>
          <div className={styles.row}>
            <label className={styles.switch}>
              Risk alerts (tilt / divergence)
              <input
                type="checkbox"
                checked={state.riskAlerts}
                onChange={(e) => setState((prev) => ({ ...prev, riskAlerts: e.target.checked }))}
              />
            </label>
            <label className={styles.switch}>
              Regression warnings
              <input
                type="checkbox"
                checked={state.regressionAlerts}
                onChange={(e) => setState((prev) => ({ ...prev, regressionAlerts: e.target.checked }))}
              />
            </label>
            <label className={styles.switch}>
              Auto copy share link
              <input
                type="checkbox"
                checked={state.copyShareLink}
                onChange={(e) => setState((prev) => ({ ...prev, copyShareLink: e.target.checked }))}
              />
            </label>
          </div>
        </article>
      </div>

      <div className={styles.actions}>
        <button className="btn primary" type="button" onClick={save}>
          Save settings
        </button>
        {savedAt ? <p className={styles.saved}>Saved at {savedAt}</p> : null}
      </div>

      <article className={styles.tips}>
        <h3>Recommended next settings</h3>
        <ul>
          <li>Timezone + day cutoff hour (for correct daily stats)</li>
          <li>Hard daily loss limit and max red days in a row</li>
          <li>Default day tags (FOMO, Revenge, Overtrade, Late Entry)</li>
          <li>AI advice frequency (daily / every 3 days / weekly)</li>
          <li>Privacy options for shared cards (public / anonymized)</li>
        </ul>
      </article>
    </section>
  );
}
