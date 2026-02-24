import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import SettingsClient from "@/components/settings/SettingsClient";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { getLocaleFromCookies, t } from "@/lib/i18n";

export default async function SettingsPage() {
  const locale = await getLocaleFromCookies();
  const m = t(locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="site dashboard">
      <header className="topbar">
        <div className="logo logo-light">{m.appName} · {m.settings}</div>
        <nav className="nav">
          <LanguageSwitcher locale={locale} />
          <Link className="btn" href="/app">
            {m.navBackToApp}
          </Link>
        </nav>
      </header>
      <p className="note" style={{ marginTop: 0, marginBottom: "8px" }}>
        {m.account}: {user.email}
      </p>
      <SettingsClient userKey={user.id} locale={locale} />
    </main>
  );
}
