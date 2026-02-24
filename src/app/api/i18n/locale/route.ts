import { NextResponse } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, locales, type Locale } from "@/lib/i18n";

export async function POST(req: Request) {
  let locale: Locale = DEFAULT_LOCALE;
  try {
    const body = (await req.json()) as { locale?: string };
    const value = String(body?.locale ?? "").toLowerCase();
    if (locales.includes(value as Locale)) {
      locale = value as Locale;
    }
  } catch {
    locale = DEFAULT_LOCALE;
  }

  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
