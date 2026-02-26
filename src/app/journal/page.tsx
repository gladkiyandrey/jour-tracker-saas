import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserFromSessionCookies } from "@/lib/current-user";
import { getLocaleFromCookies, t } from "@/lib/i18n";
import { isAdminEmail } from "@/lib/admin-auth";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import PremarketJournalClient from "@/components/journal/PremarketJournalClient";

export default async function JournalPage() {
  const locale = await getLocaleFromCookies();
  const m = t(locale);
  const user = await getCurrentUserFromSessionCookies();

  if (!user) {
    redirect("/login");
  }

  const email = user.email;
  const admin = isAdminEmail(email);
  const nameFromEmail = email.split("@")[0] || "User";
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
          <div className="logo logo-light">{m.appName}</div>
        </div>
        <nav className="topbar-center">
          <Link className="btn btn-nav-plain" href="/app">
            {m.navHome}
          </Link>
          <Link className="btn btn-nav-plain" href="/journal" aria-current="page">
            {m.navJournal}
          </Link>
          <Link className="btn btn-nav-plain" href="/pricing">
            {m.navPricing}
          </Link>
        </nav>
        <nav className="topbar-right">
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

      <PremarketJournalClient locale={locale} />
    </main>
  );
}
