import Link from "next/link";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

type LoginPageProps = {
  searchParams?: { error?: string };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const error = searchParams?.error;
  const errorMessage =
    error === "invalid_credentials"
      ? "Account not found or wrong password. Click Create account if you are new."
      : error === "invalid_signup"
        ? "Invalid signup data. Use a valid email and password (min 6 chars)."
        : error === "signup_failed"
          ? "Signup failed. Try another email or sign in if account already exists."
          : error === "oauth_sync_failed" || error === "oauth_no_session"
            ? "Google sign in failed. Please try again."
            : error === "auth_unavailable"
              ? "Authentication service is temporarily unavailable."
              : "";

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
        {errorMessage ? <p className="note auth-error">{errorMessage}</p> : null}

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
              <button className="btn auth-btn primary" type="submit">
                Sign in
              </button>
              <button className="btn auth-btn" type="submit" formAction="/api/auth/register">
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
