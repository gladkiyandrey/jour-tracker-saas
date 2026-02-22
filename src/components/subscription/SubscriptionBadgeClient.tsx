"use client";

import { useMemo, useState } from "react";

type Props = {
  active: boolean;
  expiresAt: string | null;
};

const MONTHLY_PRICE = 5;

export default function SubscriptionBadgeClient({ active, expiresAt }: Props) {
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState(1);

  const expiresText = useMemo(() => {
    if (!expiresAt) return "Unknown";
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleDateString("ru-RU");
  }, [expiresAt]);

  const pricing = useMemo(() => {
    const base = months * MONTHLY_PRICE;
    const hasDiscount = months >= 12;
    const discount = hasDiscount ? base * 0.15 : 0;
    const total = base - discount;
    return { base, discount, total, hasDiscount };
  }, [months]);

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
            <p className="note">Выберите количество месяцев. Цена: $5 / месяц.</p>
            <form action="/api/billing/activate" method="post">
              <label className="label" htmlFor="renew-months">
                Месяцев
              </label>
              <select
                id="renew-months"
                name="months"
                className="select"
                value={months}
                onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))}
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} мес.
                  </option>
                ))}
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
