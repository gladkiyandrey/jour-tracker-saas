import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/admin-auth";
import { listSubscriptionGrantsForAdmin, listSubscriptionsForAdmin } from "@/lib/subscription-store";

function fmtDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ru-RU");
}

type PageProps = {
  searchParams?: Promise<{ q?: string; grantOk?: string; grantError?: string }> | { q?: string; grantOk?: string; grantError?: string };
};

export default async function AdminSubscriptionsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!isAdminEmail(user.email)) {
    redirect("/app");
  }

  const params = searchParams ? await searchParams : {};
  const q = String(params?.q ?? "").trim().toLowerCase();
  const grantOk = String(params?.grantOk ?? "").trim();
  const grantError = String(params?.grantError ?? "").trim();
  const [rows, grants] = await Promise.all([listSubscriptionsForAdmin(500), listSubscriptionGrantsForAdmin(50)]);
  const filtered = q ? rows.filter((row) => row.email.includes(q) || row.userId.toLowerCase().includes(q)) : rows;

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
        <h2 style={{ margin: 0, fontSize: "20px" }}>Выдать бесплатный доступ</h2>
        <p className="note" style={{ marginTop: "6px", marginBottom: 0 }}>
          Укажи email или user_id, срок и причину. Подписка продлится от текущей даты окончания (или от сейчас, если уже истекла).
        </p>
        <form className="admin-grant" action="/api/admin/subscriptions/grant" method="post">
          <input className="input admin-grant-target" type="text" name="target" placeholder="email или user_id" required />
          <select className="select admin-grant-days" name="days" defaultValue="7" required>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
          <input className="input admin-grant-reason" type="text" name="reason" placeholder="Причина (friend / trial / support)" />
          <button className="btn primary" type="submit">
            Grant access
          </button>
        </form>
        {grantOk ? <p className="admin-grant-ok">{grantOk}</p> : null}
        {grantError ? <p className="admin-grant-error">{grantError}</p> : null}

        <hr className="admin-divider" />

        <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "20px" }}>Подписки пользователей</h2>
        <div className="note" style={{ marginTop: 0 }}>
          Показывает: кто оплатил, когда оплатил и когда подписка заканчивается.
        </div>
        <form className="admin-search" action="/admin/subscriptions" method="get">
          <input
            className="input admin-search-input"
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Поиск по email или user_id"
          />
          <button className="btn primary" type="submit">
            Найти
          </button>
          {q ? (
            <Link className="btn" href="/admin/subscriptions">
              Сбросить
            </Link>
          ) : null}
        </form>
        <div className="note" style={{ marginTop: "8px" }}>
          Найдено: {filtered.length}
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
                <span title="Код тарифа подписки (monthly или yearly).">Тариф</span>
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
            {filtered.map((row) => (
              <tr key={row.userId}>
                <td>
                  <div>{row.email}</div>
                  <div className="admin-sub-id">{row.userId}</div>
                  <Link className="admin-user-link" href={`/admin/users/${row.userId}`}>
                    Карточка пользователя
                  </Link>
                </td>
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>Ничего не найдено по запросу.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <hr className="admin-divider" />

        <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "20px" }}>Последние выдачи trial</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Кому</th>
              <th>Кто выдал</th>
              <th>Срок</th>
              <th>Причина</th>
              <th>Новый expires_at</th>
              <th>Когда выдано</th>
            </tr>
          </thead>
          <tbody>
            {grants.map((row) => (
              <tr key={row.id}>
                <td>
                  <div>{row.targetEmail}</div>
                  <div className="admin-sub-id">{row.targetUserId}</div>
                </td>
                <td>
                  <div>{row.grantedByEmail}</div>
                  <div className="admin-sub-id">{row.grantedByUserId}</div>
                </td>
                <td>{row.days} дн.</td>
                <td>{row.reason || "-"}</td>
                <td>{fmtDate(row.expiresAtAfter)}</td>
                <td>{fmtDate(row.createdAt)}</td>
              </tr>
            ))}
            {grants.length === 0 ? (
              <tr>
                <td colSpan={6}>Журнал выдач пока пустой (или не создана таблица subscription_grants).</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
