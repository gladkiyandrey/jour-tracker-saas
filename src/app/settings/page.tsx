import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="site dashboard">
      <header className="topbar">
        <div className="logo logo-light">Consist settings</div>
        <nav className="nav">
          <Link className="btn" href="/app">
            Back to app
          </Link>
        </nav>
      </header>
      <p className="note" style={{ marginTop: 0, marginBottom: "8px" }}>
        Account: {user.email}
      </p>
      <SettingsClient userKey={user.id} />
    </main>
  );
}
