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
          {admin ? (
            <Link className="btn admin-icon-btn" href="/admin" aria-label={m.navAdmin} title={m.navAdmin}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          ) : null}
          <Link className="btn settings-icon-btn" href="/settings" aria-label={m.settings} title={m.settings}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 6h7M14 6h6M4 12h3M10 12h10M4 18h11M18 18h2M11 4v4M7 10v4M15 16v4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <form action="/api/auth/logout" method="post" className="logout-form">
            <button className="btn logout-icon-btn" type="submit" aria-label={m.logout} title={m.logout}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M13 5V3a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7a1 1 0 0 0 1-1v-2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 12h11M17 7l5 5-5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </nav>
      </header>
      <p className="note" style={{ marginTop: 0, marginBottom: "8px" }}>
        {m.signedInAs}: {email}
      </p>
      <TrackerClient userKey={userKey} locale={locale} />
    </main>
  );
}
