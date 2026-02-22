"use client";

import { useMemo, useState } from "react";

type Props = {
  active: boolean;
  expiresAt: string | null;
};

const MONTHLY_PRICE = 5;
const YEAR_MONTHS = 12;
const YEAR_DISCOUNT = 0.15;
type PlanType = "monthly" | "yearly";

export default function SubscriptionBadgeClient({ active, expiresAt }: Props) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<PlanType>("monthly");

  const expiresText = useMemo(() => {
    if (!expiresAt) return "Unknown";
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleDateString("ru-RU");
  }, [expiresAt]);

  const pricing = useMemo(() => {
    const months = plan === "yearly" ? YEAR_MONTHS : 1;
    const base = months * MONTHLY_PRICE;
    const hasDiscount = plan === "yearly";
    const discount = hasDiscount ? base * YEAR_DISCOUNT : 0;
    const total = base - discount;
    return { base, discount, total, hasDiscount, months };
  }, [plan]);

  return (
    <>
      <div className="sub-wrap">
        <span className={`badge ${active ? "active" : ""}`}>Subscription: {active ? "Active" : "Inactive"}</span>
        <div className="sub-tooltip">
          <p>Действует до: {expiresText}</p>
          <button
            type="button"
            className="sub-renew-link"
            onClick={() => {
              setOpen(true);
            }}
          >
            Продлить подписку
          </button>
        </div>
      </div>

      {open ? (
        <div className="sub-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="sub-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Продление подписки</h3>
            <p className="note">Выберите план. Цена: $5 / месяц. Годовой план: скидка 15%.</p>
            <form action="/api/billing/activate" method="post">
              <label className="label" htmlFor="renew-plan">
                План
              </label>
              <select
                id="renew-plan"
                name="plan"
                className="select"
                value={plan}
                onChange={(e) => setPlan(e.target.value === "yearly" ? "yearly" : "monthly")}
              >
                <option value="monthly">1 месяц — $5</option>
                <option value="yearly">12 месяцев — $51 (-15%)</option>
              </select>

              <div className="sub-price-box">
                <div>Базовая сумма: ${pricing.base.toFixed(2)}</div>
                <div>Скидка: {pricing.hasDiscount ? "-15%" : "0%"}</div>
                <div className="sub-total">Итого: ${pricing.total.toFixed(2)}</div>
                {pricing.hasDiscount ? <div className="sub-discount-note">Годовой пакет: скидка 15% применена.</div> : null}
              </div>

              <div className="sub-modal-actions">
                <button type="button" className="btn" onClick={() => setOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn primary">
                  Оплатить и продлить
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
