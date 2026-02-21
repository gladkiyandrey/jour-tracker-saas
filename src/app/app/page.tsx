import Link from "next/link";
import { getSessionEmail, getSubscriptionState } from "@/lib/auth";
import TrackerClient from "@/components/tracker/TrackerClient";

export default async function DashboardPage() {
  const email = await getSessionEmail();
  const sub = await getSubscriptionState();
  const userKey = email ?? "guest";

  return (
    <main className="site dashboard">
      <div className="top-logo-bar">
        <div className="logo-mark" />
        <div className="logo">Jour</div>
      </div>
      <header className="topbar">
        <div className="logo logo-light">Trading Calendar</div>
        <nav className="nav">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className={`badge ${sub.active ? "active" : ""}`}>Subscription: {sub.active ? "Active" : "Inactive"}</span>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="btn" type="submit">
              Logout
            </button>
          </form>
        </nav>
      </header>

      <section className="card">
        <h1>Dashboard</h1>
        <p className="note">Signed in as: {email}</p>
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
