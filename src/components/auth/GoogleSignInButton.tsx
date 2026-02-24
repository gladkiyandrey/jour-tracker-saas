"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";

type Props = {
  label?: string;
};

export default function GoogleSignInButton({ label = "Sign in with Google" }: Props) {
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
      <span>{label}</span>
    </button>
  );
}
