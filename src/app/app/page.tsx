import { redirect } from "next/navigation";
import { getSubscriptionState } from "@/lib/auth";
import { getCurrentUserFromSessionCookies } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/admin-auth";
import { getSubscriptionStateFromDb } from "@/lib/subscription-store";
import { getLocaleFromCookies, t } from "@/lib/i18n";
import { getUserSettings } from "@/lib/user-settings-store";
import DashboardHomeClient from "@/components/dashboard/DashboardHomeClient";

const SUBSCRIPTION_DB_TIMEOUT_MS = 700;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("timeout"));
    }, timeoutMs);

    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timer));
  });
}

export default async function DashboardPage() {
  const locale = await getLocaleFromCookies();
  const m = t(locale);
  const cookieSub = await getSubscriptionState();
  const user = await getCurrentUserFromSessionCookies();
  if (!user) {
    redirect("/login");
  }
  const email = user.email;
  const admin = isAdminEmail(email);
  let sub = cookieSub;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const dbSub = await withTimeout(getSubscriptionStateFromDb(user.id), SUBSCRIPTION_DB_TIMEOUT_MS);
      sub = { active: dbSub.active, expiresAt: dbSub.expiresAt };
    } catch {
      // fallback to cookie state
    }
  }
  const settings = await getUserSettings(user.id).catch(() => ({ timezone: "UTC", startDeposit: 10000 }));
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
    <DashboardHomeClient
      userKey={userKey}
      locale={locale}
      subActive={sub.active}
      subExpiresAt={sub.expiresAt}
      avatarUrl={user.avatarUrl}
      displayName={displayName}
      initials={initials}
      roleLabel={roleLabel}
      admin={admin}
      navHome={m.navHome}
      navPricing={m.navPricing}
      settingsLabel={m.settings}
      adminLabel={m.navAdmin}
      logoutLabel={m.logout}
      initialTimeZone={settings.timezone}
    />
  );
}
