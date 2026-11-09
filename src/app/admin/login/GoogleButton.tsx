"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ labels }: { labels: { google: string; redirecting: string; failed: string } }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin/mfa`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError(labels.failed);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="a-btn a-btn-primary w-full py-3 text-base"
      >
        {loading ? labels.redirecting : labels.google}
      </button>
      {error && <p role="alert" className="mt-3 text-center text-sm text-[var(--a-danger-ink)]">{error}</p>}
    </>
  );
}
