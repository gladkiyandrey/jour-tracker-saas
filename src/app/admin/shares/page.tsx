import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/admin-auth";
import { listSharesForAdmin } from "@/lib/share-store";

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function fmtDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ru-RU");
}

export default async function AdminSharesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/app");

  const rows = await listSharesForAdmin(500);
  const totalBytes = rows.reduce((sum, row) => sum + row.approxBytes, 0);

  return (
    <main className="site dashboard">
      <header className="topbar">
        <div className="logo">Shares Admin</div>
        <nav className="nav">
          <Link className="btn" href="/admin">
            Back to Admin
          </Link>
        </nav>
      </header>

      <section className="card" style={{ overflowX: "auto" }}>
        <p className="note" style={{ marginTop: 0 }}>
          Shares: {rows.length} | Approx storage: {(totalBytes / 1024).toFixed(1)} KB
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Month</th>
              <th>Score</th>
              <th>Created</th>
              <th>Approx size</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.email}</td>
                <td>
                  {monthNames[row.month]} {row.year}
                </td>
                <td>{row.score}%</td>
                <td>{fmtDate(row.createdAt)}</td>
                <td>{(row.approxBytes / 1024).toFixed(1)} KB</td>
                <td>
                  <a href={row.publicUrlPath} target="_blank" rel="noreferrer">
                    {row.publicUrlPath}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
