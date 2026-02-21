import Link from "next/link";
import { getSessionEmail, getSubscriptionState } from "@/lib/auth";
import TrackerClient from "@/components/tracker/TrackerClient";

export default async function DashboardPage() {
  const email = await getSessionEmail();
  const sub = await getSubscriptionState();
  const userKey = email ?? "guest";

  return (
    <main className="site dashboard">
      <header className="topbar">
        <div className="logo">Jour</div>
        <nav className="nav">
          <form action="/api/auth/logout" method="post">
            <button className="btn" type="submit">
              Logout
            </button>
          </form>
        </nav>
      </header>

      <section className="card">
        <h1>Your Dashboard</h1>
        <p className="note">Signed in as: {email}</p>
        <div style={{ marginTop: "14px" }}>
          <span className={`badge ${sub.active ? "active" : ""}`}>
            Subscription: {sub.active ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="note" style={{ marginTop: "16px" }}>
          Here your personal calendar data will be loaded from the database (per user).
        </p>
        {!sub.active ? (
          <p className="note">
            You need an active subscription. Go to <Link href="/pricing">Pricing</Link>.
          </p>
        ) : null}
      </section>

      <TrackerClient userKey={userKey} />
    </main>
  );
}
