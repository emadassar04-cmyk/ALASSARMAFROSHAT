"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton() {
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
      setError("تعذر بدء تسجيل الدخول. حاول مرة أخرى.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="w-full rounded-lg bg-gold px-4 py-3 font-medium text-white transition hover:bg-gold-dark disabled:opacity-60"
      >
        {loading ? "جارٍ التحويل إلى Google…" : "الدخول بحساب Google"}
      </button>
      {error && <p role="alert" className="mt-3 text-center text-sm text-red-700">{error}</p>}
    </>
  );
}
