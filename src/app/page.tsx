import Link from "next/link";

export default function HomePage() {
  return (
    <main className="site">
      <header className="topbar">
        <div className="logo">Jour</div>
        <nav className="nav">
          <Link className="btn" href="/login">
            Login
          </Link>
          <Link className="btn primary" href="/pricing">
            Get Access
          </Link>
        </nav>
      </header>

      <section className="hero card">
        <h1>Build discipline. Track consistency. Trade with structure.</h1>
        <p>
          Jour is a subscription SaaS for traders. Users log in, manage their personal calendar,
          and keep access only with an active crypto subscription.
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

      <p className="footer-note">Next step: connect Supabase + crypto payment provider webhooks.</p>
    </main>
  );
}
