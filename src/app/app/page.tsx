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
          <Link className="btn" href="/">
            Home
          </Link>
          <Link className="btn" href="/pricing">
            Pricing
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="btn" type="submit">
              Logout
            </button>
          </form>
        </nav>
      </header>
      <p className="note" style={{ marginTop: 0, marginBottom: "8px" }}>
        Signed in as: {email}
      </p>
      <TrackerClient userKey={userKey} />
    </main>
  );
}
