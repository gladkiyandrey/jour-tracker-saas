"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Finishing sign in...");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabaseBrowser();
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const refreshToken = sessionData.session?.refresh_token;
        if (!token || !refreshToken) {
          window.location.replace("/login?error=oauth_no_session");
          return;
        }

        const syncRes = await fetch("/api/auth/session-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: token, refreshToken }),
        });

        if (!syncRes.ok) {
          window.location.replace("/login?error=oauth_sync_failed");
          return;
        }

        const active = syncRes.headers.get("x-sub-active") === "1";
        window.location.replace(active ? "/app" : "/pricing");
      } catch {
        setMessage("Sign in failed. Return to login and try again.");
      }
    };

    run();
  }, []);

  return (
    <main className="site">
      <section className="card form-wrap">
        <h1>Google Sign In</h1>
        <p className="note">{message}</p>
      </section>
    </main>
  );
}
