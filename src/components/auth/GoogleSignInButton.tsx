"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function GoogleSignInButton() {
  const onClick = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <button
      className="btn"
      type="button"
      style={{ marginTop: "12px", width: "100%", display: "inline-flex", justifyContent: "center" }}
      onClick={onClick}
    >
      Continue with Google
    </button>
  );
}

