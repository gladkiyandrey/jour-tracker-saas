import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { getSubscriptionStateFromDb } from "@/lib/subscription-store";

type PricingPageProps = {
  searchParams?: Promise<{ expired?: string; error?: string }>;
};

export default async function PricingPage({ searchParams }: PricingPageProps) {
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
        <div className="logo">Consist</div>
        <nav className="nav">
          <Link className="btn" href="/">
            Home
          </Link>
          <Link className="btn" href="/login">
            Login
          </Link>
        </nav>
      </header>

      <section className="card form-wrap">
        <h1>Crypto Subscription</h1>
        {expired ? (
          <div className="warning-box">
            Подписка истекла {expiredAt ? `(до ${new Date(expiredAt).toLocaleDateString("ru-RU")})` : ""}. Чтобы продолжить работу,
            оплатите тариф.
          </div>
        ) : null}
        {params.error === "activate_failed" ? <div className="warning-box">Не удалось активировать подписку. Попробуйте снова.</div> : null}
        <p className="note">
          This page is wired for a mock activation. Replace with Coinbase Commerce/NOWPayments checkout.
        </p>

        <form action="/api/billing/activate" method="post">
          <label className="label" htmlFor="plan">
            Plan
          </label>
          <select className="select" id="plan" name="plan" defaultValue="monthly">
            <option value="monthly">Monthly - 29 USDT</option>
            <option value="quarterly">Quarterly - 79 USDT</option>
          </select>

          <button className="btn primary" type="submit" style={{ marginTop: "18px", width: "100%" }}>
            Activate (Mock)
          </button>
        </form>
      </section>
    </main>
  );
}
