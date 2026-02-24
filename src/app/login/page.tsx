import Link from "next/link";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { getLocaleFromCookies, t } from "@/lib/i18n";

type LoginPageProps = {
  searchParams?:
    | Promise<{ error?: string; success?: string; email?: string; reason?: string }>
    | { error?: string; success?: string; email?: string; reason?: string };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const locale = await getLocaleFromCookies();
  const m = t(locale);
  const params = searchParams ? await searchParams : {};
  const error = params?.error;
  const success = params?.success;
  const email = params?.email ?? "";
  const reason = params?.reason ?? "";
  const i18nError = {
    invalidCredentials:
      locale === "ru"
        ? "Аккаунт не найден или неверный пароль. Если вы новый пользователь, нажмите «Создать аккаунт»."
        : locale === "uk"
          ? "Акаунт не знайдено або неправильний пароль. Якщо ви новий користувач, натисніть «Створити акаунт»."
          : "Account not found or wrong password. Click Create account if you are new.",
    invalidSignup:
      locale === "ru"
        ? "Некорректные данные регистрации. Используйте валидный email и пароль (минимум 6 символов)."
        : locale === "uk"
          ? "Некоректні дані реєстрації. Використовуйте валідний email і пароль (мінімум 6 символів)."
          : "Invalid signup data. Use a valid email and password (min 6 chars).",
    emailExists:
      locale === "ru"
        ? "Этот email уже зарегистрирован. Используйте «Войти»."
        : locale === "uk"
          ? "Цей email вже зареєстрований. Використайте «Увійти»."
          : "This email is already registered. Use Sign in.",
    signupDisabled:
      locale === "ru"
        ? "Регистрация отключена в настройках Email provider в Supabase."
        : locale === "uk"
          ? "Реєстрацію вимкнено в налаштуваннях Email provider у Supabase."
          : "Signup is disabled in Supabase Email provider settings.",
    rateLimited:
      locale === "ru"
        ? "Слишком много попыток. Подождите минуту и попробуйте снова."
        : locale === "uk"
          ? "Забагато спроб. Зачекайте хвилину і спробуйте знову."
          : "Too many attempts. Please wait a minute and try again.",
    badKey:
      locale === "ru"
        ? "Несоответствие Supabase ключей. Проверьте ANON/PUBLISHABLE keys в Vercel."
        : locale === "uk"
          ? "Невідповідність Supabase ключів. Перевірте ANON/PUBLISHABLE keys у Vercel."
          : "Supabase key mismatch. Check ANON/PUBLISHABLE keys in Vercel.",
    signupFailed:
      locale === "ru" ? "Регистрация не удалась. Попробуйте снова." : locale === "uk" ? "Реєстрація не вдалася. Спробуйте ще раз." : "Signup failed. Try again.",
    oauthFailed:
      locale === "ru" ? "Не удалось войти через Google. Повторите попытку." : locale === "uk" ? "Не вдалося увійти через Google. Спробуйте ще раз." : "Google sign in failed. Please try again.",
    authBadEnv:
      locale === "ru"
        ? "Переменные окружения Auth отсутствуют или неверны в Vercel."
        : locale === "uk"
          ? "Змінні середовища Auth відсутні або некоректні у Vercel."
          : "Auth env vars are missing or invalid in Vercel.",
    authUnavailable:
      locale === "ru" ? "Сервис авторизации временно недоступен." : locale === "uk" ? "Сервіс авторизації тимчасово недоступний." : "Authentication service is temporarily unavailable.",
    checkEmail:
      locale === "ru"
        ? "Аккаунт создан. Подтвердите email во входящих, затем войдите."
        : locale === "uk"
          ? "Акаунт створено. Підтвердьте email у пошті, потім увійдіть."
          : "Account created. Confirm your email in inbox, then sign in.",
  };
  const errorMessage =
    error === "invalid_credentials"
      ? i18nError.invalidCredentials
      : error === "invalid_signup"
        ? i18nError.invalidSignup
        : error === "signup_failed"
          ? reason === "email_exists"
            ? i18nError.emailExists
            : reason === "signup_disabled"
              ? i18nError.signupDisabled
              : reason === "rate_limited"
                ? i18nError.rateLimited
                : reason === "bad_supabase_key"
                  ? i18nError.badKey
                  : i18nError.signupFailed
          : error === "oauth_sync_failed" || error === "oauth_no_session"
            ? i18nError.oauthFailed
            : error === "auth_unavailable"
              ? reason === "bad_env"
                ? i18nError.authBadEnv
                : i18nError.authUnavailable
              : "";
  const successMessage =
    success === "check_email"
      ? i18nError.checkEmail
      : "";

  return (
    <main className="site">
      <header className="topbar">
        <div className="logo">{m.appName}</div>
        <nav className="nav">
          <LanguageSwitcher locale={locale} />
          <Link className="btn" href="/">
            {m.navHome}
          </Link>
          <Link className="btn" href="/pricing">
            {m.navPricing}
          </Link>
        </nav>
      </header>

      <section className="card form-wrap">
        <h1>{m.loginTitle}</h1>
        <p className="note">{m.loginText}</p>
        {errorMessage ? <p className="note auth-error">{errorMessage}</p> : null}
        {successMessage ? <p className="note auth-success">{successMessage}</p> : null}

        <form action="/api/auth/login" method="post">
          <label className="label" htmlFor="email">
            {m.email}
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
            {m.password}
          </label>
          <input className="input" id="password" name="password" type="password" placeholder="••••••••" required />

          <div className="auth-actions">
            <div className="auth-row">
              <button className="btn auth-btn primary" type="submit">
                {m.signIn}
              </button>
              <button className="btn auth-btn" type="submit" formAction="/api/auth/register">
                {m.createAccount}
              </button>
            </div>
            <div className="auth-google">
              <GoogleSignInButton label={m.signInGoogle} />
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
