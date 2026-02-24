import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { getSubscriptionStateFromDb } from "@/lib/subscription-store";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { getLocaleFromCookies, t } from "@/lib/i18n";

type PricingPageProps = {
  searchParams?: Promise<{ expired?: string; error?: string }>;
};

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const locale = await getLocaleFromCookies();
  const m = t(locale);
  const params = (await searchParams) ?? {};
  const user = await getCurrentUser();
  let expired = params.expired === "1";
  let expiredAt: string | null = null;

  if (user && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const sub = await getSubscriptionStateFromDb(user.id);
      expired = !sub.active && !!sub.expiresAt && Date.parse(sub.expiresAt) <= Date.now();
      expiredAt = sub.expiresAt;
    } catch {
      // ignore and keep fallback query-based warning
    }
  }

  return (
    <main className="site">
      <header className="topbar">
        <div className="logo">{m.appName}</div>
        <nav className="nav">
          <LanguageSwitcher locale={locale} />
          <Link className="btn" href="/">
            {m.navHome}
          </Link>
          <Link className="btn" href="/login">
            {m.navLogin}
          </Link>
        </nav>
      </header>

      <section className="card form-wrap">
        <h1>{m.pricingTitle}</h1>
        {expired ? (
          <div className="warning-box">
            {m.subExpired} {expiredAt ? `(${new Date(expiredAt).toLocaleDateString(locale === "uk" ? "uk-UA" : locale === "ru" ? "ru-RU" : "en-US")})` : ""}.
          </div>
        ) : null}
        {params.error === "activate_failed" ? <div className="warning-box">{m.activateFailed}</div> : null}
        <p className="note">
          {m.pricingText}
        </p>

        <form action="/api/billing/activate" method="post">
          <label className="label" htmlFor="plan">
            {m.plan}
          </label>
          <select className="select" id="plan" name="plan" defaultValue="monthly">
            <option value="monthly">{m.monthlyPlan}</option>
            <option value="yearly">{m.yearlyPlan}</option>
          </select>

          <button className="btn primary" type="submit" style={{ marginTop: "18px", width: "100%" }}>
            {m.activateMock}
          </button>
        </form>
      </section>
    </main>
  );
}
