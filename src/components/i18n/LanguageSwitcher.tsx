"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
};

export default function LanguageSwitcher({ locale }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<Locale>(locale);
  const [loading, setLoading] = useState(false);

  const onChange = async (next: Locale) => {
    setValue(next);
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

  return (
    <label className="lang-switch" aria-label="Language">
      <span>Lang</span>
      <select value={value} disabled={loading} onChange={(e) => onChange(e.target.value as Locale)}>
        <option value="en">EN</option>
        <option value="ru">RU</option>
        <option value="uk">UK</option>
      </select>
    </label>
  );
}
