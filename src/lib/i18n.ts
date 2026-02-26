import { cookies } from "next/headers";

export const locales = ["en", "ru", "uk"] as const;
export type Locale = (typeof locales)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "consist_locale";

function isLocale(value: string | undefined): value is Locale {
  return !!value && locales.includes(value as Locale);
}

export async function getLocaleFromCookies(): Promise<Locale> {
  try {
    const store = await cookies();
    const raw = store.get(LOCALE_COOKIE)?.value;
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

type Dict = {
  appName: string;
  navHome: string;
  navPricing: string;
  navJournal: string;
  navLogin: string;
  navAdmin: string;
  navBackToApp: string;
  settings: string;
  logout: string;
  signedInAs: string;
  account: string;
  homeTitle: string;
  homeText: string;
  homeGetAccess: string;
  homeFooter: string;
  loginTitle: string;
  loginText: string;
  signIn: string;
  createAccount: string;
  email: string;
  password: string;
  signInGoogle: string;
  pricingTitle: string;
  pricingText: string;
  plan: string;
  activateMock: string;
  subExpired: string;
  activateFailed: string;
  monthlyPlan: string;
  yearlyPlan: string;
};

export const messages: Record<Locale, Dict> = {
  en: {
    appName: "Consist",
    navHome: "Home",
    navPricing: "Pricing",
    navJournal: "Journal",
    navLogin: "Login",
    navAdmin: "Admin",
    navBackToApp: "Back to app",
    settings: "Settings",
    logout: "Logout",
    signedInAs: "Signed in as",
    account: "Account",
    homeTitle: "Build discipline. Track consistency. Trade with structure.",
    homeText:
      "Consist is a subscription SaaS for traders. Users log in, manage their personal calendar, and keep access only with an active subscription.",
    homeGetAccess: "Get Access",
    homeFooter: "Next step: connect Supabase + payment provider webhooks.",
    loginTitle: "Login",
    loginText: "Sign in with Google or use email/password with Supabase Auth.",
    signIn: "Sign in",
    createAccount: "Create account",
    email: "Email",
    password: "Password",
    signInGoogle: "Sign in with Google",
    pricingTitle: "Subscription",
    pricingText: "Choose your plan and activate access.",
    plan: "Plan",
    activateMock: "Activate (Mock)",
    subExpired: "Subscription expired",
    activateFailed: "Could not activate subscription. Try again.",
    monthlyPlan: "1 month - $5",
    yearlyPlan: "12 months - $51 (-15%)",
  },
  ru: {
    appName: "Consist",
    navHome: "Главная",
    navPricing: "Тариф",
    navJournal: "Журнал",
    navLogin: "Вход",
    navAdmin: "Админ",
    navBackToApp: "Назад в приложение",
    settings: "Настройки",
    logout: "Выход",
    signedInAs: "Вошли как",
    account: "Аккаунт",
    homeTitle: "Развивай дисциплину. Отслеживай стабильность. Торгуй системно.",
    homeText:
      "Consist — это подписочный SaaS для трейдеров. Пользователь входит в аккаунт, ведет личный календарь и сохраняет доступ только при активной подписке.",
    homeGetAccess: "Получить доступ",
    homeFooter: "Следующий шаг: подключить Supabase + вебхуки платежного провайдера.",
    loginTitle: "Вход",
    loginText: "Вход через Google или через email/пароль на Supabase Auth.",
    signIn: "Войти",
    createAccount: "Создать аккаунт",
    email: "Email",
    password: "Пароль",
    signInGoogle: "Войти через Google",
    pricingTitle: "Подписка",
    pricingText: "Выберите тариф и активируйте доступ.",
    plan: "Тариф",
    activateMock: "Активировать (Mock)",
    subExpired: "Подписка истекла",
    activateFailed: "Не удалось активировать подписку. Попробуйте снова.",
    monthlyPlan: "1 месяц - $5",
    yearlyPlan: "12 месяцев - $51 (-15%)",
  },
  uk: {
    appName: "Consist",
    navHome: "Головна",
    navPricing: "Тариф",
    navJournal: "Журнал",
    navLogin: "Вхід",
    navAdmin: "Адмін",
    navBackToApp: "Назад у застосунок",
    settings: "Налаштування",
    logout: "Вийти",
    signedInAs: "Увійшли як",
    account: "Акаунт",
    homeTitle: "Розвивай дисципліну. Відстежуй стабільність. Торгуй системно.",
    homeText:
      "Consist — це SaaS за підпискою для трейдерів. Користувач входить в акаунт, веде особистий календар і зберігає доступ лише з активною підпискою.",
    homeGetAccess: "Отримати доступ",
    homeFooter: "Наступний крок: підключити Supabase + вебхуки платіжного провайдера.",
    loginTitle: "Вхід",
    loginText: "Вхід через Google або через email/пароль на Supabase Auth.",
    signIn: "Увійти",
    createAccount: "Створити акаунт",
    email: "Email",
    password: "Пароль",
    signInGoogle: "Увійти через Google",
    pricingTitle: "Підписка",
    pricingText: "Оберіть тариф і активуйте доступ.",
    plan: "Тариф",
    activateMock: "Активувати (Mock)",
    subExpired: "Підписка завершилась",
    activateFailed: "Не вдалося активувати підписку. Спробуйте ще раз.",
    monthlyPlan: "1 місяць - $5",
    yearlyPlan: "12 місяців - $51 (-15%)",
  },
};

export function t(locale: Locale) {
  return messages[locale] || messages[DEFAULT_LOCALE];
}
