"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Props = {
  active: boolean;
  expiresAt: string | null;
  locale: Locale;
  mode?: "badge" | "panel" | "icon";
};

const MONTHLY_PRICE = 5;
const YEAR_MONTHS = 12;
const YEAR_DISCOUNT = 0.15;
type PlanType = "monthly" | "yearly";

export default function SubscriptionBadgeClient({ active, expiresAt, locale, mode = "badge" }: Props) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<PlanType>("monthly");

  const expiresText = useMemo(() => {
    if (!expiresAt) return "Unknown";
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US");
  }, [expiresAt, locale]);

  const txt = useMemo(() => {
    if (locale === "ru") {
      return {
        sub: "Подписка",
        active: "Активна",
        inactive: "Неактивна",
        validTo: "Действует до",
        renew: "Продлить подписку",
        renewTitle: "Продление подписки",
        renewText: "Выберите план. Цена: $5 / месяц. Годовой план: скидка 15%.",
        plan: "План",
        monthly: "1 месяц — $5",
        yearly: "12 месяцев — $51 (-15%)",
        base: "Базовая сумма",
        discount: "Скидка",
        total: "Итого",
        yearlyApplied: "Годовой пакет: скидка 15% применена.",
        cancel: "Отмена",
        pay: "Оплатить и продлить",
      };
    }
    if (locale === "uk") {
      return {
        sub: "Підписка",
        active: "Активна",
        inactive: "Неактивна",
        validTo: "Діє до",
        renew: "Продовжити підписку",
        renewTitle: "Продовження підписки",
        renewText: "Оберіть план. Ціна: $5 / місяць. Річний план: знижка 15%.",
        plan: "План",
        monthly: "1 місяць — $5",
        yearly: "12 місяців — $51 (-15%)",
        base: "Базова сума",
        discount: "Знижка",
        total: "Разом",
        yearlyApplied: "Річний пакет: знижку 15% застосовано.",
        cancel: "Скасувати",
        pay: "Оплатити і продовжити",
      };
    }
    return {
      sub: "Subscription",
      active: "Active",
      inactive: "Inactive",
      validTo: "Valid until",
      renew: "Renew subscription",
      renewTitle: "Renew subscription",
      renewText: "Choose plan. Price: $5 / month. Yearly plan: 15% discount.",
      plan: "Plan",
      monthly: "1 month — $5",
      yearly: "12 months — $51 (-15%)",
      base: "Base amount",
      discount: "Discount",
      total: "Total",
      yearlyApplied: "Yearly package: 15% discount applied.",
      cancel: "Cancel",
      pay: "Pay and renew",
    };
  }, [locale]);

  const pricing = useMemo(() => {
    const months = plan === "yearly" ? YEAR_MONTHS : 1;
    const base = months * MONTHLY_PRICE;
    const hasDiscount = plan === "yearly";
    const discount = hasDiscount ? base * YEAR_DISCOUNT : 0;
    const total = base - discount;
    return { base, discount, total, hasDiscount, months };
  }, [plan]);

  const mainUi =
    mode === "icon" ? (
      <div className="sub-wrap sub-wrap-icon">
        <button type="button" className={`sub-icon-btn ${active ? "active" : "inactive"}`} aria-label={txt.sub}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M10 2.6l6 2.4v4.3c0 4.3-2.6 6.7-6 8.1-3.4-1.4-6-3.8-6-8.1V5l6-2.4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M7.4 10.2l1.8 1.8 3.4-3.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <div className="sub-tooltip">
          <p>{txt.sub}: {active ? txt.active : txt.inactive}</p>
          <p>{txt.validTo}: {expiresText}</p>
          <button
            type="button"
            className="sub-renew-link"
            onClick={() => {
              setOpen(true);
            }}
          >
            {txt.renew}
          </button>
        </div>
      </div>
    ) : mode === "panel" ? (
      <div className="sub-panel-inline">
        <span className={`user-sub-chip ${active ? "active" : "inactive"}`}>
          {txt.sub}: {active ? txt.active : txt.inactive}
        </span>
        <p className="sub-panel-exp">{txt.validTo}: {expiresText}</p>
        <button
          type="button"
          className="sub-renew-link sub-renew-link-inline"
          onClick={() => {
            setOpen(true);
          }}
        >
          {txt.renew}
        </button>
      </div>
    ) : (
      <div className="sub-wrap">
        <span className={`badge ${active ? "active" : ""}`}>{txt.sub}: {active ? txt.active : txt.inactive}</span>
        <div className="sub-tooltip">
          <p>{txt.validTo}: {expiresText}</p>
          <button
            type="button"
            className="sub-renew-link"
            onClick={() => {
              setOpen(true);
            }}
          >
            {txt.renew}
          </button>
        </div>
      </div>
    );

  return (
    <>
      {mainUi}
      {open ? (
        <div className="sub-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="sub-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{txt.renewTitle}</h3>
            <p className="note">{txt.renewText}</p>
            <form action="/api/billing/activate" method="post">
              <label className="label" htmlFor="renew-plan">
                {txt.plan}
              </label>
              <select
                id="renew-plan"
                name="plan"
                className="select"
                value={plan}
                onChange={(e) => setPlan(e.target.value === "yearly" ? "yearly" : "monthly")}
              >
                <option value="monthly">{txt.monthly}</option>
                <option value="yearly">{txt.yearly}</option>
              </select>

              <div className="sub-price-box">
                <div>{txt.base}: ${pricing.base.toFixed(2)}</div>
                <div>{txt.discount}: {pricing.hasDiscount ? "-15%" : "0%"}</div>
                <div className="sub-total">{txt.total}: ${pricing.total.toFixed(2)}</div>
                {pricing.hasDiscount ? <div className="sub-discount-note">{txt.yearlyApplied}</div> : null}
              </div>

              <div className="sub-modal-actions">
                <button type="button" className="btn" onClick={() => setOpen(false)}>
                  {txt.cancel}
                </button>
                <button type="submit" className="btn primary">
                  {txt.pay}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
