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
    <button className="google-btn" type="button" onClick={onClick}>
      <span className="google-mark" aria-hidden>
        G
      </span>
      <span>Sign in with Google</span>
    </button>
  );
}
