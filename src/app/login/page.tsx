import Link from "next/link";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

type LoginPageProps = {
  searchParams?:
    | Promise<{ error?: string; success?: string; email?: string; reason?: string }>
    | { error?: string; success?: string; email?: string; reason?: string };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const error = params?.error;
  const success = params?.success;
  const email = params?.email ?? "";
  const reason = params?.reason ?? "";
  const errorMessage =
    error === "invalid_credentials"
      ? "Account not found or wrong password. Click Create account if you are new."
      : error === "invalid_signup"
        ? "Invalid signup data. Use a valid email and password (min 6 chars)."
        : error === "signup_failed"
          ? reason === "email_exists"
            ? "This email is already registered. Use Sign in."
            : reason === "signup_disabled"
              ? "Signup is disabled in Supabase Email provider settings."
              : reason === "rate_limited"
                ? "Too many attempts. Please wait a minute and try again."
                : reason === "bad_supabase_key"
                  ? "Supabase key mismatch. Check ANON/PUBLISHABLE keys in Vercel."
                  : "Signup failed. Try again."
          : error === "oauth_sync_failed" || error === "oauth_no_session"
            ? "Google sign in failed. Please try again."
            : error === "auth_unavailable"
              ? reason === "bad_env"
                ? "Auth env vars are missing or invalid in Vercel."
                : "Authentication service is temporarily unavailable."
              : "";
  const successMessage =
    success === "check_email"
      ? "Account created. Confirm your email in inbox, then sign in."
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
        {successMessage ? <p className="note auth-success">{successMessage}</p> : null}

        <form action="/api/auth/login" method="post">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            className="input"
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            defaultValue={email}
            required
          />

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
