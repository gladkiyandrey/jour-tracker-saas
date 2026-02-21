import Link from "next/link";
import { redirect } from "next/navigation";
import { getSubscriptionState } from "@/lib/auth";
import { getCurrentUser } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/admin-auth";
import { getSubscriptionStateFromDb } from "@/lib/subscription-store";
import TrackerClient from "@/components/tracker/TrackerClient";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const email = user.email;
  const admin = isAdminEmail(email);
  let sub = await getSubscriptionState();
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const dbSub = await getSubscriptionStateFromDb(user.id);
      sub = { active: dbSub.active, expiresAt: dbSub.expiresAt };
    } catch {
      // fallback to cookie state
    }
  }
  const userKey = user.id;

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
          {admin ? (
            <Link className="btn" href="/admin">
              Admin
            </Link>
          ) : null}
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
