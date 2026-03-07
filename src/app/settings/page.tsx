import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import SettingsClient from "@/components/settings/SettingsClient";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import SiteLogo from "@/components/ui/SiteLogo";
import { getLocaleFromCookies, t } from "@/lib/i18n";
import { getUserSettings } from "@/lib/user-settings-store";

export default async function SettingsPage() {
  const locale = await getLocaleFromCookies();
  const m = t(locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const settings = await getUserSettings(user.id).catch(() => ({ timezone: "UTC", startDeposit: 10000 }));

  return (
    <main className="site dashboard">
      <header className="topbar">
        <div className="settings-logo-wrap">
          <SiteLogo href="/app" className="logo-light" />
          <span className="settings-logo-label">{m.settings}</span>
        </div>
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
      <SettingsClient userKey={user.id} locale={locale} initialTimezone={settings.timezone} initialStartDeposit={settings.startDeposit} />
    </main>
  );
}
