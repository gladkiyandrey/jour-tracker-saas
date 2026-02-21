import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/admin-auth";
import { listSubscriptionsForAdmin } from "@/lib/subscription-store";
import { listSharesForAdmin } from "@/lib/share-store";

export default async function AdminHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/app");

  const [subs, shares] = await Promise.all([listSubscriptionsForAdmin(500), listSharesForAdmin(500)]);
  const activeSubs = subs.filter((s) => !s.isExpired && s.status === "active").length;
  const totalShareKb = shares.reduce((sum, row) => sum + row.approxBytes, 0) / 1024;

  return (
    <main className="site dashboard">
      <header className="topbar">
        <div className="logo">Admin Panel</div>
        <nav className="nav">
          <Link className="btn" href="/app">
            Back to App
          </Link>
        </nav>
      </header>

      <section className="card admin-hub">
        <h1>Overview</h1>
        <div className="grid">
          <div className="kpi">
            Subscriptions
            <strong>{subs.length}</strong>
          </div>
          <div className="kpi">
            Active
            <strong>{activeSubs}</strong>
          </div>
          <div className="kpi">
            Shares
            <strong>{shares.length}</strong>
          </div>
        </div>
        <p className="note">Approx share storage: {totalShareKb.toFixed(1)} KB</p>

        <div className="admin-actions">
          <Link className="btn primary" href="/admin/subscriptions">
            Open Subscriptions
          </Link>
          <Link className="btn primary" href="/admin/shares">
            Open Shares
          </Link>
        </div>
      </section>
    </main>
  );
}
