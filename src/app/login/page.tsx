import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="site">
      <header className="topbar">
        <div className="logo">Jour</div>
        <nav className="nav">
          <Link className="btn" href="/">
            Home
          </Link>
          <Link className="btn" href="/pricing">
            Pricing
          </Link>
        </nav>
      </header>

      <section className="card form-wrap">
        <h1>Login</h1>
        <p className="note">Temporary auth flow. Replace with Supabase/Auth.js in production.</p>

        <form action="/api/auth/login" method="post">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" placeholder="you@example.com" required />

          <label className="label" htmlFor="password">
            Password
          </label>
          <input className="input" id="password" name="password" type="password" placeholder="••••••••" required />

          <button className="btn primary" type="submit" style={{ marginTop: "18px", width: "100%" }}>
            Login
          </button>
        </form>
      </section>
    </main>
  );
}
