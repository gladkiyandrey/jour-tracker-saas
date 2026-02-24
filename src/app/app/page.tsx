import Link from "next/link";
import { redirect } from "next/navigation";
import { getSubscriptionState } from "@/lib/auth";
import { getCurrentUser } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/admin-auth";
import { getSubscriptionStateFromDb } from "@/lib/subscription-store";
import TrackerClient from "@/components/tracker/TrackerClient";
import SubscriptionBadgeClient from "@/components/subscription/SubscriptionBadgeClient";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { getLocaleFromCookies, t } from "@/lib/i18n";

export default async function DashboardPage() {
  const locale = await getLocaleFromCookies();
  const m = t(locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const email = user.email;
  const admin = isAdminEmail(email);
  let sub = await getSubscriptionState();
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const dbSub = await getSubscriptionStateFromDb(user.id);
      sub = { active: dbSub.active, expiresAt: dbSub.expiresAt };
    } catch {
      // fallback to cookie state
    }
  }
  const userKey = user.id;
  const nameFromEmail = email.split("@")[0] || "User";
  const fallbackName = nameFromEmail
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
  const displayName = (user.displayName || fallbackName).trim();
  const initials = displayName
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
      <div className="top-logo-bar">
        <div className="logo-mark" />
        <div className="logo">{m.appName}</div>
      </div>
      <header className="topbar">
        <div className="logo logo-light">{m.appName}</div>
        <nav className="nav">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <SubscriptionBadgeClient active={sub.active} expiresAt={sub.expiresAt} locale={locale} />
          </div>
          <LanguageSwitcher locale={locale} />
          <Link className="btn" href="/">
            {m.navHome}
          </Link>
          <Link className="btn" href="/pricing">
            {m.navPricing}
          </Link>
          <details className="user-menu">
            <summary className="user-menu-summary">
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
                  {m.logout}
                </button>
              </form>
            </div>
          </details>
        </nav>
      </header>
      <p className="note" style={{ marginTop: 0, marginBottom: "8px" }}>
        {m.signedInAs}: {email}
      </p>
      <TrackerClient userKey={userKey} locale={locale} />
    </main>
  );
}
