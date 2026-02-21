import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="site">
      <header className="topbar">
        <div className="logo">Jour</div>
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
