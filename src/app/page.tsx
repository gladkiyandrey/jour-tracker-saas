import Link from "next/link";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { getLocaleFromCookies, t } from "@/lib/i18n";
import SiteLogo from "@/components/ui/SiteLogo";

export default async function HomePage() {
  const locale = await getLocaleFromCookies();
  const m = t(locale);

  return (
    <main className="site">
      <header className="topbar">
        <SiteLogo href="/" />
        <nav className="nav">
          <LanguageSwitcher locale={locale} />
          <Link className="btn" href="/login">
            {m.navLogin}
          </Link>
          <Link className="btn primary" href="/pricing">
            {m.homeGetAccess}
          </Link>
        </nav>
      </header>

      <section className="hero card">
        <h1>{m.homeTitle}</h1>
        <p>
          {m.homeText}
        </p>
      </section>

      <section className="grid">
        <article className="card kpi">
          Discipline Score
          <strong>73%</strong>
        </article>
        <article className="card kpi green">
          Green Streak
          <strong>4</strong>
        </article>
        <article className="card kpi">
          Red Streak
          <strong>2</strong>
        </article>
      </section>

      <p className="footer-note">{m.homeFooter}</p>
    </main>
  );
}
