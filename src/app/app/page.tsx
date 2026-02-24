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
    <main className="site dashboard">
      <div className="top-logo-bar">
        <div className="logo-mark" />
        <div className="logo">Consist</div>
      </div>
      <header className="topbar">
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
          <Link className="btn settings-icon-btn" href="/settings" aria-label="Settings" title="Settings">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.2 4.2-.96-.56a7.84 7.84 0 0 0-.1-1.21l.88-.67a1.1 1.1 0 0 0 .27-1.43l-1.3-2.26a1.1 1.1 0 0 0-1.37-.48l-1 .4a8.21 8.21 0 0 0-1.05-.61l-.15-1.08A1.1 1.1 0 0 0 14.33 4h-2.66a1.1 1.1 0 0 0-1.09.92l-.15 1.08c-.36.15-.71.35-1.05.6l-1-.39a1.1 1.1 0 0 0-1.37.48L5.7 8.95a1.1 1.1 0 0 0 .27 1.43l.88.67c-.05.4-.08.8-.1 1.2l-.96.57a1.1 1.1 0 0 0-.5 1.35l.87 2.46a1.1 1.1 0 0 0 1.27.72l1.06-.22c.3.29.62.55.98.77l.03 1.08A1.1 1.1 0 0 0 10.6 20h2.8a1.1 1.1 0 0 0 1.09-1.02l.03-1.08c.35-.22.68-.48.98-.77l1.06.22a1.1 1.1 0 0 0 1.27-.72l.87-2.46a1.1 1.1 0 0 0-.5-1.35Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
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
      <p className="note" style={{ marginTop: 0, marginBottom: "8px" }}>
        Signed in as: {email}
      </p>
      <TrackerClient userKey={userKey} />
    </main>
  );
}
