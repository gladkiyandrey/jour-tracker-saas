import Link from "next/link";
import { redirect } from "next/navigation";
import { getSubscriptionState } from "@/lib/auth";
import { getCurrentUserFromSessionCookies } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/admin-auth";
import { getSubscriptionStateFromDb } from "@/lib/subscription-store";
import { getLocaleFromCookies, t } from "@/lib/i18n";
import SiteLogo from "@/components/ui/SiteLogo";
import SubscriptionBadgeClient from "@/components/subscription/SubscriptionBadgeClient";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import TradeShareBuilder from "@/components/trade-share/TradeShareBuilder";
import { getUserSettings } from "@/lib/user-settings-store";

const SUBSCRIPTION_DB_TIMEOUT_MS = 700;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timer));
  });
}

export default async function TradeSharePage() {
  const locale = await getLocaleFromCookies();
  const m = t(locale);
  const cookieSub = await getSubscriptionState();
  const user = await getCurrentUserFromSessionCookies();
  if (!user) redirect("/login");

  const admin = isAdminEmail(user.email);
  let sub = cookieSub;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const dbSub = await withTimeout(getSubscriptionStateFromDb(user.id), SUBSCRIPTION_DB_TIMEOUT_MS);
      sub = { active: dbSub.active, expiresAt: dbSub.expiresAt };
    } catch {
      // cookie fallback
    }
  }
  const settings = await getUserSettings(user.id).catch(() => ({ timezone: "UTC", startDeposit: 10000 }));

  const nameFromEmail = user.email.split("@")[0] || "User";
  const fallbackName = nameFromEmail
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
  const displayName = (user.displayName || fallbackName).trim();
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";
  const roleLabel = admin
    ? locale === "ru"
      ? "Админ"
      : locale === "uk"
        ? "Адмін"
        : "Admin"
    : locale === "ru"
      ? "Личный аккаунт"
      : locale === "uk"
        ? "Особистий акаунт"
        : "Personal Account";

  return (
    <main className="site dashboard">
      <header className="topbar">
        <div className="topbar-left">
          <SiteLogo href="/app" className="logo-light" />
        </div>
        <nav className="topbar-center">
          <Link className="btn btn-nav-plain" href="/app">
            Dashboard
          </Link>
          <Link className="btn btn-nav-plain" href="/app/trade-share">
            Trade Share
          </Link>
          <Link className="btn btn-nav-plain" href="/pricing">
            {m.navPricing}
          </Link>
        </nav>
        <nav className="topbar-right">
          <SubscriptionBadgeClient active={sub.active} expiresAt={sub.expiresAt} locale={locale} mode="icon" />
          <details className="user-menu">
            <summary className="user-menu-summary top-trigger">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="user-avatar user-avatar-image" src={user.avatarUrl} alt={displayName} />
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
                {m.settings}
              </Link>
              {admin ? (
                <Link className="user-menu-link" href="/admin">
                  {m.navAdmin}
                </Link>
              ) : null}
              <form action="/api/auth/logout" method="post">
                <button className="user-menu-link user-menu-logout" type="submit">
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M12 4h4v12h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M8 6l-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 10h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  {m.logout}
                </button>
              </form>
            </div>
          </details>
          <LanguageSwitcher locale={locale} compact />
        </nav>
      </header>

      <TradeShareBuilder initialTimeZone={settings.timezone} />
    </main>
  );
}
