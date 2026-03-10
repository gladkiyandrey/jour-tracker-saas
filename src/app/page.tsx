import Link from "next/link";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { getLocaleFromCookies } from "@/lib/i18n";
import SiteLogo from "@/components/ui/SiteLogo";

const landingCopy = {
  en: {
    navLogin: "Login",
    navPricing: "Pricing",
    heroEyebrow: "Discipline system for traders",
    heroTitle: "Track discipline. Review behavior. Share trades with proof.",
    heroText:
      "Consist helps traders turn discipline into a visible system: mark every trading day, review execution patterns, and generate clean trade share cards without leaving the dashboard.",
    heroPrimary: "Start free",
    heroSecondary: "View pricing",
    heroProof: ["Manual workflow, ready today", "Behavior-first review", "Built for real posting"],
    heroStats: [
      ["Daily discipline tracking", "Color-coded days with fast end-of-day logging."],
      ["Behavior-focused review", "See whether you are stable, drifting, or overheating."],
      ["Clean trade sharing", "Turn executed trades into shareable cards in seconds."],
    ],
    problemTitle: "Most traders do not fail because of a missing setup.",
    problemText:
      "They fail because discipline stays invisible until the damage is already done. Overtrading, revenge trading, and uncontrolled frequency compound before the trader has a clear picture of behavior.",
    solutionTitle: "Consist makes discipline measurable.",
    solutionItems: [
      "Mark each day by execution quality, not by ego.",
      "See streaks, drawdown pressure, and behavioral signals in one place.",
      "Publish clean trade cards without building screenshots by hand.",
    ],
    featuresTitle: "Core product blocks",
    features: [
      {
        title: "Discipline Calendar",
        text: "Track every day as disciplined, undisciplined, or intentionally no-trade. The calendar becomes your behavioral record, not just a PnL diary.",
      },
      {
        title: "Monthly Review",
        text: "Read trade count, average daily activity, green and red PnL clusters, average error cost, and drawdown pressure at a glance.",
      },
      {
        title: "Discipline Insight",
        text: "Surface actionable guidance from your recent behavior instead of pretending that one green day means stability.",
      },
      {
        title: "Trade Share Cards",
        text: "Generate dark, premium trade cards for forex, crypto, and supported gold setups with the same layout in preview and export.",
      },
    ],
    shareTitle: "Trade cards that look deliberate, not improvised.",
    shareText:
      "A focused trade share flow with fixed design states, interval-aware chart rendering, PNG export, and consistent formatting for real posting workflows.",
    shareBullets: [
      "Long / Short and profit / loss states",
      "Consistent export output",
      "Timezone-aware trade timestamps",
    ],
    howTitle: "How it works",
    howSteps: [
      ["Log the day", "Save the result, deposit, and trades count into the discipline calendar."],
      ["Review the pattern", "Use the monthly blocks and signalizer to see whether behavior is tightening or drifting."],
      ["Share the trade", "Generate a polished card from your trade data and export it instantly."],
    ],
    audienceTitle: "Built for traders who care about execution quality.",
    audienceItems: [
      "Forex traders who want a discipline-first workflow",
      "Prop-firm challengers who must control behavior day by day",
      "Discretionary traders who need review discipline, not more indicators",
      "Traders who publish their executions and want clean visual proof",
    ],
    pricingTitle: "Simple access",
    pricingText: "One product, one workflow, one place to review behavior and share trades.",
    pricingMonthly: "Monthly",
    pricingYearly: "Yearly",
    pricingPrimary: "Get access",
    faqTitle: "FAQ",
    faqItems: [
      [
        "Is Consist a journal or a discipline tracker?",
        "It is built around discipline first. The calendar, review blocks, and signalizer are all focused on execution behavior, not only on storing trade notes.",
      ],
      [
        "Can I share trades from inside the app?",
        "Yes. Trade Share lets you generate a polished trade card and export it as PNG without leaving the dashboard.",
      ],
      [
        "Which markets are supported in Trade Share?",
        "Right now the flow is focused on forex, crypto, and XAU/USD on the current data setup.",
      ],
      [
        "Do I need broker integrations to use it?",
        "No. The current workflow is manual by design so you can use it immediately and validate your process without extra setup.",
      ],
    ],
    ctaTitle: "Build consistency before you scale size.",
    ctaText: "If your discipline is not measurable, it is not under control.",
    ctaPrimary: "Start with Consist",
  },
  ru: {
    navLogin: "Вход",
    navPricing: "Тариф",
    heroEyebrow: "Система дисциплины для трейдера",
    heroTitle: "Отслеживай дисциплину. Разбирай поведение. Делись сделками с доказательством.",
    heroText:
      "Consist помогает трейдеру превратить дисциплину в понятную систему: отмечать каждый торговый день, видеть поведенческие паттерны и собирать чистые trade share карточки прямо внутри кабинета.",
    heroPrimary: "Начать",
    heroSecondary: "Посмотреть тариф",
    heroProof: ["Ручной workflow, готовый уже сейчас", "Обзор поведения в центре", "Сделано под реальные публикации"],
    heroStats: [
      ["Ежедневный контроль дисциплины", "Цветовые дни и быстрый end-of-day лог."],
      ["Поведенческий обзор", "Видно, когда ты стабилен, дрейфуешь или перегреваешься."],
      ["Чистый trade sharing", "Собирай карточки сделок за секунды без ручных скриншотов."],
    ],
    problemTitle: "Большинство трейдеров сливают не из-за отсутствия сетапа.",
    problemText:
      "Они теряют повторяемость, потому что дисциплина остаётся невидимой до тех пор, пока ущерб уже не нанесён. Переторговка, revenge trading и неконтролируемая частота накапливаются раньше, чем появляется ясная картина поведения.",
    solutionTitle: "Consist делает дисциплину измеримой.",
    solutionItems: [
      "Отмечай день по качеству исполнения, а не по эго.",
      "Видь серии, давление просадки и поведенческие сигналы в одном месте.",
      "Публикуй чистые trade cards без ручной сборки скриншотов.",
    ],
    featuresTitle: "Ключевые блоки продукта",
    features: [
      {
        title: "Календарь дисциплины",
        text: "Фиксируй день как дисциплинированный, недисциплинированный или осознанно пропущенный. Календарь становится картой поведения, а не просто PnL-таблицей.",
      },
      {
        title: "Обзор месяца",
        text: "Сразу видно число сделок, среднюю активность, сумму зелёных и красных дней, среднюю цену ошибки и давление просадки.",
      },
      {
        title: "Совет по дисциплине",
        text: "Получай короткий вывод из своего поведения вместо самообмана после одного удачного дня.",
      },
      {
        title: "Карточки сделок",
        text: "Генерируй тёмные premium trade cards для forex, crypto и поддерживаемого gold-сценария с одинаковым видом в preview и export.",
      },
    ],
    shareTitle: "Карточки сделок, которые выглядят намеренно, а не случайно.",
    shareText:
      "Сфокусированный flow для trade share: фиксированные состояния дизайна, рендер графика по интервалу, PNG export и предсказуемый результат для реальных публикаций.",
    shareBullets: [
      "Состояния Long / Short и profit / loss",
      "Стабильный export",
      "Учёт timezone пользователя",
    ],
    howTitle: "Как это работает",
    howSteps: [
      ["Отметь день", "Сохрани результат, депозит и количество сделок в календарь дисциплины."],
      ["Разбери паттерн", "Посмотри обзор месяца и сигнализатор, чтобы понять, усиливается контроль или начинается дрейф."],
      ["Поделись сделкой", "Собери карточку сделки из своих данных и сразу выгрузи PNG."],
    ],
    audienceTitle: "Для трейдеров, которым важно качество исполнения.",
    audienceItems: [
      "Forex-трейдеры, которым нужен workflow вокруг дисциплины",
      "Трейдеры prop-firm этапов, которым нужен ежедневный контроль поведения",
      "Дискреционные трейдеры, которым нужен review, а не ещё один индикатор",
      "Трейдеры, которые публикуют сделки и хотят чистое визуальное подтверждение",
    ],
    pricingTitle: "Простой доступ",
    pricingText: "Один продукт, один workflow, одно место для обзора поведения и trade sharing.",
    pricingMonthly: "Месяц",
    pricingYearly: "Год",
    pricingPrimary: "Получить доступ",
    faqTitle: "FAQ",
    faqItems: [
      [
        "Consist — это дневник или трекер дисциплины?",
        "Он построен вокруг дисциплины. Календарь, обзор и сигнализатор заточены под качество исполнения, а не только под хранение заметок о сделках.",
      ],
      [
        "Можно ли делиться сделками прямо из приложения?",
        "Да. Trade Share позволяет собрать аккуратную карточку сделки и выгрузить её в PNG, не выходя из dashboard.",
      ],
      [
        "Какие рынки сейчас поддерживаются в Trade Share?",
        "На текущем data stack — forex, crypto и XAU/USD.",
      ],
      [
        "Нужны ли брокерские интеграции для старта?",
        "Нет. Текущий workflow специально оставлен ручным, чтобы ты мог сразу использовать продукт и проверить свою дисциплину без лишней интеграции.",
      ],
    ],
    ctaTitle: "Сначала выстрой стабильность. Потом увеличивай размер.",
    ctaText: "Если дисциплина не измеряется, значит она не находится под контролем.",
    ctaPrimary: "Начать с Consist",
  },
  uk: {
    navLogin: "Вхід",
    navPricing: "Тариф",
    heroEyebrow: "Система дисципліни для трейдера",
    heroTitle: "Відстежуй дисципліну. Аналізуй поведінку. Ділись угодами з доказом.",
    heroText:
      "Consist допомагає трейдеру перетворити дисципліну на зрозумілу систему: позначати кожен торговий день, бачити поведінкові патерни та збирати чисті trade share картки прямо в кабінеті.",
    heroPrimary: "Почати",
    heroSecondary: "Переглянути тариф",
    heroProof: ["Ручний workflow, готовий вже зараз", "Огляд поведінки в центрі", "Зроблено під реальні публікації"],
    heroStats: [
      ["Щоденний контроль дисципліни", "Кольорові дні та швидкий end-of-day лог."],
      ["Поведінковий огляд", "Видно, коли ти стабільний, дрейфуєш або перегріваєшся."],
      ["Чистий trade sharing", "Збирай картки угод за секунди без ручних скриншотів."],
    ],
    problemTitle: "Більшість трейдерів провалюються не через відсутність сетапу.",
    problemText:
      "Вони втрачають повторюваність, бо дисципліна залишається невидимою, поки шкода вже не нанесена. Переторгівля, revenge trading і неконтрольована частота накопичуються раніше, ніж з’являється ясна картина поведінки.",
    solutionTitle: "Consist робить дисципліну вимірюваною.",
    solutionItems: [
      "Позначай день за якістю виконання, а не за его.",
      "Бач серії, тиск просадки й поведінкові сигнали в одному місці.",
      "Публікуй чисті trade cards без ручного збирання скриншотів.",
    ],
    featuresTitle: "Ключові блоки продукту",
    features: [
      {
        title: "Календар дисципліни",
        text: "Фіксуй день як дисциплінований, недисциплінований або свідомо пропущений. Календар стає картою поведінки, а не просто PnL-таблицею.",
      },
      {
        title: "Огляд місяця",
        text: "Одразу видно кількість угод, середню активність, суму зелених і червоних днів, середню ціну помилки та тиск просадки.",
      },
      {
        title: "Порада щодо дисципліни",
        text: "Отримуй короткий висновок зі своєї поведінки замість самообману після одного вдалого дня.",
      },
      {
        title: "Картки угод",
        text: "Генеруй темні premium trade cards для forex, crypto та підтриманого gold-сценарію з однаковим виглядом у preview й export.",
      },
    ],
    shareTitle: "Картки угод, які виглядають навмисно, а не випадково.",
    shareText:
      "Сфокусований flow для trade share: фіксовані стани дизайну, рендер графіка за інтервалом, PNG export і передбачуваний результат для реальних публікацій.",
    shareBullets: [
      "Стани Long / Short та profit / loss",
      "Стабільний export",
      "Урахування timezone користувача",
    ],
    howTitle: "Як це працює",
    howSteps: [
      ["Познач день", "Збережи результат, депозит і кількість угод у календар дисципліни."],
      ["Проаналізуй патерн", "Подивись огляд місяця та сигналізатор, щоб зрозуміти, посилюється контроль чи починається дрейф."],
      ["Поділись угодою", "Збери картку угоди зі своїх даних і відразу експортуй PNG."],
    ],
    audienceTitle: "Для трейдерів, яким важлива якість виконання.",
    audienceItems: [
      "Forex-трейдери, яким потрібен workflow навколо дисципліни",
      "Трейдери prop-firm етапів, яким потрібен щоденний контроль поведінки",
      "Дискреційні трейдери, яким потрібен review, а не ще один індикатор",
      "Трейдери, які публікують угоди й хочуть чисте візуальне підтвердження",
    ],
    pricingTitle: "Простий доступ",
    pricingText: "Один продукт, один workflow, одне місце для огляду поведінки та trade sharing.",
    pricingMonthly: "Місяць",
    pricingYearly: "Рік",
    pricingPrimary: "Отримати доступ",
    faqTitle: "FAQ",
    faqItems: [
      [
        "Consist — це журнал чи трекер дисципліни?",
        "Він побудований навколо дисципліни. Календар, огляд і сигналізатор заточені під якість виконання, а не лише під зберігання нотаток про угоди.",
      ],
      [
        "Чи можна ділитися угодами прямо з застосунку?",
        "Так. Trade Share дозволяє зібрати акуратну картку угоди й експортувати її в PNG, не виходячи з dashboard.",
      ],
      [
        "Які ринки зараз підтримуються в Trade Share?",
        "На поточному data stack — forex, crypto та XAU/USD.",
      ],
      [
        "Чи потрібні брокерські інтеграції для старту?",
        "Ні. Поточний workflow спеціально залишений ручним, щоб ти міг одразу використовувати продукт і перевірити свою дисципліну без зайвої інтеграції.",
      ],
    ],
    ctaTitle: "Спочатку вибудуй стабільність. Потім збільшуй розмір.",
    ctaText: "Якщо дисципліна не вимірюється, значить вона не під контролем.",
    ctaPrimary: "Почати з Consist",
  },
} as const;

export default async function HomePage() {
  const locale = await getLocaleFromCookies();
  const copy = landingCopy[locale];

  return (
    <main className="landing-shell">
      <div className="site landing-site">
        <header className="topbar landing-topbar">
          <SiteLogo href="/" />
          <nav className="nav landing-nav">
            <LanguageSwitcher locale={locale} />
            <Link className="btn" href="/login">
              {copy.navLogin}
            </Link>
            <Link className="btn primary" href="/pricing">
              {copy.navPricing}
            </Link>
          </nav>
        </header>

        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">{copy.heroEyebrow}</span>
            <h1>{copy.heroTitle}</h1>
            <p>{copy.heroText}</p>
            <div className="landing-hero-actions">
              <Link className="btn primary landing-cta-primary" href="/login">
                {copy.heroPrimary}
              </Link>
              <Link className="btn landing-cta-secondary" href="/pricing">
                {copy.heroSecondary}
              </Link>
            </div>
            <div className="landing-proof-strip">
              {copy.heroProof.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="landing-stat-grid">
              {copy.heroStats.map(([title, text]) => (
                <article key={title} className="landing-stat-card">
                  <strong>{title}</strong>
                  <span>{text}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="landing-hero-visual">
            <div className="landing-dashboard-card">
              <div className="landing-window-bar">
                <span />
                <span />
                <span />
              </div>
              <div className="landing-dashboard-grid">
                <div className="landing-mock-hero">
                  <div className="landing-mock-kpis">
                    <div className="landing-mock-kpi landing-mock-kpi-green">
                      <span>Discipline Score</span>
                      <strong>81%</strong>
                    </div>
                    <div className="landing-mock-kpi">
                      <span>Green Streak</span>
                      <strong>6</strong>
                    </div>
                    <div className="landing-mock-kpi landing-mock-kpi-red">
                      <span>Red Streak</span>
                      <strong>1</strong>
                    </div>
                  </div>
                  <div className="landing-calendar-card">
                    <div className="landing-card-head">
                      <strong>Discipline Calendar</strong>
                      <small>March review</small>
                    </div>
                    <div className="landing-calendar-grid">
                      {[
                        "g",
                        "g",
                        "n",
                        "o",
                        "g",
                        "g",
                        "n",
                        "g",
                        "g",
                        "o",
                        "g",
                        "n",
                        "g",
                        "g",
                        "g",
                        "n",
                        "o",
                        "g",
                        "g",
                        "g",
                        "n",
                      ].map((state, index) => (
                        <span
                          key={`${state}-${index}`}
                          className={`landing-day-chip ${
                            state === "n"
                              ? "is-neg"
                              : state === "o"
                                ? "is-outline"
                                : "is-pos"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="landing-bottom-showcase">
                    <div className="landing-insight-card">
                      <div className="landing-card-head">
                        <strong>Discipline insight</strong>
                        <small>Behavior-based guidance</small>
                      </div>
                      <p>
                        Three red days in the last nine sessions. Reduce activity and return to core setups only.
                      </p>
                    </div>
                    <div className="landing-share-card">
                      <div className="landing-share-top">
                        <span>EUR/USD</span>
                        <span className="landing-share-side">Long</span>
                        <strong>+2.88%</strong>
                      </div>
                      <div className="landing-share-chart">
                        <div className="landing-share-gridline landing-share-gridline-left" />
                        <div className="landing-share-gridline landing-share-gridline-right" />
                        <i className="landing-share-line landing-share-line-gray" />
                        <i className="landing-share-line landing-share-line-green" />
                      </div>
                      <div className="landing-share-grid">
                        <span>Entry price</span>
                        <span>1.15687 USD</span>
                        <span>Close Date</span>
                        <span>06 Mar, 18:37</span>
                        <span>Risk</span>
                        <span>2%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-problem-grid">
          <article className="landing-problem-card">
            <span className="landing-section-tag">Problem</span>
            <h2>{copy.problemTitle}</h2>
            <p>{copy.problemText}</p>
          </article>
          <article className="landing-solution-card">
            <span className="landing-section-tag">Solution</span>
            <h2>{copy.solutionTitle}</h2>
            <ul className="landing-solution-list">
              {copy.solutionItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="landing-section">
          <div className="landing-section-head">
            <span className="landing-section-tag">Features</span>
            <h2>{copy.featuresTitle}</h2>
          </div>
          <div className="landing-feature-grid">
            {copy.features.map((feature) => (
              <article key={feature.title} className="landing-feature-card">
                <div className="landing-feature-icon" />
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-share-section">
          <div className="landing-share-copy">
            <span className="landing-section-tag">Trade Share</span>
            <h2>{copy.shareTitle}</h2>
            <p>{copy.shareText}</p>
            <ul className="landing-bullet-list">
              {copy.shareBullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
          <div className="landing-share-preview">
            <div className="landing-share-preview-card">
              <div className="landing-share-preview-head">
                <span>GBP/USD</span>
                <span className="is-short">Short</span>
                <strong>+1.19%</strong>
              </div>
              <div className="landing-share-preview-chart">
                <div className="landing-chart-glow" />
                <div className="landing-share-gridline landing-share-gridline-left" />
                <div className="landing-share-gridline landing-share-gridline-right" />
                <svg viewBox="0 0 320 180" className="landing-chart-svg" aria-hidden>
                  <path d="M0 74 C25 58, 40 100, 64 92 C92 84, 90 28, 116 48 C142 68, 144 112, 170 110 C200 108, 210 26, 236 38 C268 54, 276 142, 320 126" />
                </svg>
              </div>
              <div className="landing-share-preview-meta">
                <span>Entry price</span>
                <span>1.33515 USD</span>
                <span>Exit price</span>
                <span>1.33181 USD</span>
                <span>Duration</span>
                <span>2h 55m</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-head">
            <span className="landing-section-tag">Workflow</span>
            <h2>{copy.howTitle}</h2>
          </div>
          <div className="landing-steps-grid">
            {copy.howSteps.map(([title, text], index) => (
              <article key={title} className="landing-step-card">
                <span className="landing-step-index">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-head">
            <span className="landing-section-tag">Audience</span>
            <h2>{copy.audienceTitle}</h2>
          </div>
          <div className="landing-audience-grid">
            {copy.audienceItems.map((item) => (
              <article key={item} className="landing-audience-card">
                <span className="landing-audience-dot" />
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-pricing-section">
          <div className="landing-section-head">
            <span className="landing-section-tag">Pricing</span>
            <h2>{copy.pricingTitle}</h2>
            <p>{copy.pricingText}</p>
          </div>
          <div className="landing-pricing-card">
            <div className="landing-pricing-plan">
              <span>{copy.pricingMonthly}</span>
              <strong>$5</strong>
              <small>{copy.pricingText}</small>
            </div>
            <div className="landing-pricing-plan landing-pricing-plan-accent">
              <span>{copy.pricingYearly}</span>
              <strong>$51</strong>
              <small>12 months · -15%</small>
            </div>
            <Link className="btn primary landing-pricing-cta" href="/pricing">
              {copy.pricingPrimary}
            </Link>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-head">
            <span className="landing-section-tag">FAQ</span>
            <h2>{copy.faqTitle}</h2>
          </div>
          <div className="landing-faq-list">
            {copy.faqItems.map(([question, answer]) => (
              <article key={question} className="landing-faq-card">
                <h3>{question}</h3>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-final-cta">
          <span className="landing-section-tag">Start</span>
          <h2>{copy.ctaTitle}</h2>
          <p>{copy.ctaText}</p>
          <div className="landing-final-actions">
            <Link className="btn primary landing-cta-primary" href="/login">
              {copy.ctaPrimary}
            </Link>
            <Link className="btn landing-cta-secondary" href="/pricing">
              {copy.navPricing}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
