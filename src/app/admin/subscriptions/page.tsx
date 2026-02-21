import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/admin-auth";
import { listSubscriptionsForAdmin } from "@/lib/subscription-store";

function fmtDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ru-RU");
}

export default async function AdminSubscriptionsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!isAdminEmail(user.email)) {
    redirect("/app");
  }

  const rows = await listSubscriptionsForAdmin(500);

  return (
    <main className="site dashboard">
      <header className="topbar">
        <div className="logo">Subscriptions Admin</div>
        <nav className="nav">
          <Link className="btn" href="/admin">
            Back to Admin
          </Link>
        </nav>
      </header>

      <section className="card" style={{ overflowX: "auto" }}>
        <div className="note" style={{ marginTop: 0 }}>
          Показывает: кто оплатил, когда оплатил и когда подписка заканчивается.
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <span title="Email пользователя, у которого оформлена подписка.">Пользователь</span>
              </th>
              <th>
                <span title="Текущий статус подписки: active, inactive, past_due, canceled или expired.">Статус</span>
              </th>
              <th>
                <span title="Код тарифа подписки (например monthly, quarterly).">Тариф</span>
              </th>
              <th>
                <span title="Дата последней успешной оплаты или активации подписки.">Дата оплаты</span>
              </th>
              <th>
                <span title="Дата и время, до которых подписка активна.">Действует до</span>
              </th>
              <th>
                <span title="Дата первой активации/создания подписки пользователя.">Начало подписки</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId}>
                <td>{row.email}</td>
                <td>
                  <span className={`status-chip ${row.isExpired ? "expired" : row.status === "active" ? "active" : "inactive"}`}>
                    {row.isExpired ? "expired" : row.status}
                  </span>
                </td>
                <td>{row.planCode ?? "-"}</td>
                <td>{fmtDate(row.lastPaymentAt)}</td>
                <td>{fmtDate(row.expiresAt)}</td>
                <td>{fmtDate(row.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
