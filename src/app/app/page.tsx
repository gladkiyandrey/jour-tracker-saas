import Link from "next/link";
import { redirect } from "next/navigation";
import { getSubscriptionState } from "@/lib/auth";
import { getCurrentUser } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/admin-auth";
import { getSubscriptionStateFromDb } from "@/lib/subscription-store";
import TrackerClient from "@/components/tracker/TrackerClient";
import SubscriptionBadgeClient from "@/components/subscription/SubscriptionBadgeClient";

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
    <main className="dashboardLayout">
      <aside className="dashboardSidebar">
        <div className="sidebarBrand">
          <div className="logo-mark" />
          <div className="logo">Consist</div>
        </div>
        <nav className="sidebarNav">
          <Link className="sidebarLink active" href="/app">Dashboard</Link>
          <a className="sidebarLink" href="#calendar">Calendar</a>
          <a className="sidebarLink" href="#review">Review</a>
          <a className="sidebarLink" href="#signals">Signals</a>
          <Link className="sidebarLink" href="/pricing">Pricing</Link>
          {admin ? <Link className="sidebarLink" href="/admin">Admin</Link> : null}
        </nav>
      </aside>

      <div className="dashboardMain">
        <header className="dashboardTopbar">
          <div className="logo logo-light">Consist</div>
          <nav className="nav">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <SubscriptionBadgeClient active={sub.active} expiresAt={sub.expiresAt} />
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
            <form action="/api/auth/logout" method="post" className="logout-form">
              <button className="btn logout-icon-btn" type="submit" aria-label="Logout" title="Logout">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M13 5V3a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7a1 1 0 0 0 1-1v-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 12h11M17 7l5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>
          </nav>
        </header>

        <section className="site dashboard">
          <p className="note" style={{ marginTop: 0, marginBottom: "8px" }}>
            Signed in as: {email}
          </p>
          <TrackerClient userKey={userKey} />
        </section>
      </div>
    </main>
  );
}
