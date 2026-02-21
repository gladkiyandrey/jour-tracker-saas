import Link from "next/link";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

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
        <p className="note">Sign in with Google or use email/password with Supabase Auth.</p>

        <form action="/api/auth/login" method="post">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" placeholder="you@example.com" required />

          <label className="label" htmlFor="password">
            Password
          </label>
          <input className="input" id="password" name="password" type="password" placeholder="••••••••" required />

          <div className="auth-actions">
            <div className="auth-row">
            <button className="btn primary" type="submit">
              Sign in
            </button>
            <button className="btn" type="submit" formAction="/api/auth/register">
              Create account
            </button>
            </div>
            <div className="auth-google">
              <GoogleSignInButton />
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
