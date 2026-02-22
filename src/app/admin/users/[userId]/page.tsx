import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/admin-auth";
import { getAdminUserCard } from "@/lib/admin-user-store";

function fmtDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ru-RU");
}

export default async function AdminUserCardPage({ params }: { params: Promise<{ userId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/app");

  const { userId } = await params;
  const card = await getAdminUserCard(userId);
  if (!card) notFound();

  const sub = card.subscription;
  const isExpired = !!sub?.expiresAt && Date.parse(sub.expiresAt) <= Date.now();

  return (
    <main className="site dashboard">
      <header className="topbar">
        <div className="logo">User Card</div>
        <nav className="nav">
          <Link className="btn" href="/admin/subscriptions">
            Back to Subscriptions
          </Link>
          <Link className="btn" href="/admin">
            Admin Home
          </Link>
        </nav>
      </header>

      <section className="card admin-user-card">
        <h1>{card.email ?? "unknown"}</h1>
        <p className="note" style={{ marginTop: "6px" }}>
          user_id: {card.userId}
        </p>

        <div className="grid admin-user-kpis">
          <div className="kpi">
            Tracker entries
            <strong>{card.trackerEntriesCount}</strong>
          </div>
          <div className="kpi">
            Entries (30d)
            <strong>{card.trackerEntries30d}</strong>
          </div>
          <div className="kpi">
            Shares
            <strong>{card.shareCount}</strong>
          </div>
        </div>

        <div className="admin-user-meta">
          <div>
            <span>Registered</span>
            <strong>{fmtDate(card.userCreatedAt)}</strong>
          </div>
          <div>
            <span>Last sign-in</span>
            <strong>{fmtDate(card.lastSignInAt)}</strong>
          </div>
          <div>
            <span>Subscription status</span>
            <strong className={`status-chip ${isExpired ? "expired" : sub?.status === "active" ? "active" : "inactive"}`}>
              {sub ? (isExpired ? "expired" : sub.status) : "no subscription"}
            </strong>
          </div>
          <div>
            <span>Plan</span>
            <strong>{sub?.planCode ?? "-"}</strong>
          </div>
          <div>
            <span>Last payment</span>
            <strong>{fmtDate(sub?.lastPaymentAt ?? null)}</strong>
          </div>
          <div>
            <span>Expires at</span>
            <strong>{fmtDate(sub?.expiresAt ?? null)}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

