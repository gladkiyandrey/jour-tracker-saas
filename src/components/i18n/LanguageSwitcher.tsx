"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
};

export default function LanguageSwitcher({ locale }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<Locale>(locale);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const onChange = async (next: Locale) => {
    if (next === value) {
      setOpen(false);
      return;
    }
    setValue(next);
    setOpen(false);
    setLoading(true);
    try {
      await fetch("/api/i18n/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
    } finally {
      setLoading(false);
      router.refresh();
    }
  };

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }
      const target = event.target as Node | null;
      if (target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const labels: Record<Locale, string> = {
    en: "English",
    ru: "Русский",
    uk: "Українська",
  };

  const order: Locale[] = ["en", "ru", "uk"];

  return (
    <div className={`lang-switch ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="lang-switch-trigger"
        aria-label="Change language"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={loading}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="lang-chip">{value.toUpperCase()}</span>
        <span className="lang-name">{labels[value]}</span>
        <span className="lang-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      <div className="lang-switch-menu" role="menu" aria-label="Language options">
        {order.map((item) => (
          <button
            key={item}
            type="button"
            role="menuitem"
            className={`lang-switch-option ${value === item ? "is-active" : ""}`}
            onClick={() => onChange(item)}
            disabled={loading}
          >
            <span className="lang-chip">{item.toUpperCase()}</span>
            <span className="lang-name">{labels[item]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
