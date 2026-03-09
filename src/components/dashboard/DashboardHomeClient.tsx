"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import DashboardTrackerLoader from "@/components/tracker/DashboardTrackerLoader";
import SubscriptionBadgeClient from "@/components/subscription/SubscriptionBadgeClient";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import SiteLogo from "@/components/ui/SiteLogo";
import TradeShareBuilder from "@/components/trade-share/TradeShareBuilder";

type Props = {
  userKey: string;
  locale: Locale;
  subActive: boolean;
  subExpiresAt: string | null;
  avatarUrl?: string;
  displayName: string;
  initials: string;
  roleLabel: string;
  admin: boolean;
  navHome: string;
  navPricing: string;
  settingsLabel: string;
  adminLabel: string;
  logoutLabel: string;
  initialTimeZone: string;
};

export default function DashboardHomeClient({
  userKey,
  locale,
  subActive,
  subExpiresAt,
  avatarUrl,
  displayName,
  initials,
  roleLabel,
  admin,
  navHome,
  navPricing,
  settingsLabel,
  adminLabel,
  logoutLabel,
  initialTimeZone,
}: Props) {
  const [tradeShareOpen, setTradeShareOpen] = useState(false);

  useEffect(() => {
    if (!tradeShareOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTradeShareOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [tradeShareOpen]);

  return (
    <main className="site dashboard">
      <header className="topbar">
        <div className="topbar-left">
          <SiteLogo href="/app" className="logo-light" />
        </div>
        <nav className="topbar-center">
          <Link className="btn btn-nav-plain" href="/">
            {navHome}
          </Link>
          <button className="btn btn-nav-plain" type="button" onClick={() => setTradeShareOpen(true)}>
            Trade Share
          </button>
          <Link className="btn btn-nav-plain" href="/pricing">
            {navPricing}
          </Link>
        </nav>
        <nav className="topbar-right">
          <SubscriptionBadgeClient active={subActive} expiresAt={subExpiresAt} locale={locale} mode="icon" />
          <details className="user-menu">
            <summary className="user-menu-summary top-trigger">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="user-avatar user-avatar-image" src={avatarUrl} alt={displayName} />
              ) : (
                <span className="user-avatar">{initials}</span>
              )}
              <span className="user-meta">
                <strong>{displayName}</strong>
                <small>{roleLabel}</small>
              </span>
              <svg className="user-chevron" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="user-menu-panel">
              <Link className="user-menu-link" href="/settings">
                {settingsLabel}
              </Link>
              {admin ? (
                <Link className="user-menu-link" href="/admin">
                  {adminLabel}
                </Link>
              ) : null}
              <form action="/api/auth/logout" method="post">
                <button className="user-menu-link user-menu-logout" type="submit">
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M12 4h4v12h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M8 6l-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 10h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  {logoutLabel}
                </button>
              </form>
            </div>
          </details>
          <LanguageSwitcher locale={locale} compact />
        </nav>
      </header>

      <DashboardTrackerLoader userKey={userKey} locale={locale} />

      {tradeShareOpen ? (
        <div className="trade-share-modal-backdrop" role="presentation" onClick={() => setTradeShareOpen(false)}>
          <div className="trade-share-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="trade-share-modal-head">
              <div>
                <h3>Trade Share</h3>
                <p>Create and export a trade card without leaving your dashboard.</p>
              </div>
              <button className="trade-share-modal-close" type="button" aria-label="Close Trade Share" onClick={() => setTradeShareOpen(false)}>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="trade-share-modal-body">
              <TradeShareBuilder initialTimeZone={initialTimeZone} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
