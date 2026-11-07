"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode =
  | { kind: "loading" }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string }
  | { kind: "error"; message: string };

export function MfaForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") return router.replace("/admin");

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return setMode({ kind: "error", message: "تعذر قراءة إعدادات التحقق." });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setMode({ kind: "verify", factorId: verified.id });

      // إزالة أي تسجيل سابق لم يكتمل، ثم بدء تسجيل جديد
      for (const f of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "لوحة الإدارة" });
      if (enrolled.error) {
        return setMode({ kind: "error", message: "تعذر تفعيل التحقق بخطوتين. تأكد أن TOTP مفعّل في Supabase." });
      }
      setMode({
        kind: "enroll",
        factorId: enrolled.data.id,
        qr: enrolled.data.totp.qr_code,
        secret: enrolled.data.totp.secret,
      });
    })();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode.kind !== "enroll" && mode.kind !== "verify") return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code });
    if (error) {
      setError("الرمز غير صحيح أو انتهت صلاحيته. أدخل الرمز الحالي من التطبيق.");
      setBusy(false);
      return;
    }
    const { error: rpcError } = await supabase.rpc("record_staff_login", { p_user_agent: navigator.userAgent });
    if (rpcError) {
      await supabase.auth.signOut();
      return router.replace("/admin/login?error=not_staff");
    }
    router.replace("/admin");
    router.refresh();
  }

  if (mode.kind === "loading") return <p className="text-center" aria-live="polite">جارٍ التحميل…</p>;
  if (mode.kind === "error") return <p role="alert" className="text-center text-red-700">{mode.message}</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode.kind === "enroll" ? (
        <div className="space-y-3 text-sm">
          <p>
            <strong>أول مرة فقط:</strong> افتح تطبيق المصادقة (Google Authenticator أو Microsoft Authenticator)،
            واختر إضافة حساب، ثم امسح هذا الرمز:
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- رمز QR بصيغة SVG من Supabase */}
          <img src={mode.qr} alt="رمز QR لتطبيق المصادقة" className="mx-auto h-48 w-48 rounded bg-white p-2" />
          <details className="rounded border border-gold/30 p-2">
            <summary className="cursor-pointer">لا أستطيع المسح؟ أدخل المفتاح يدوياً</summary>
            <code dir="ltr" className="mt-2 block break-all text-center">{mode.secret}</code>
          </details>
        </div>
      ) : (
        <p className="text-sm">أدخل الرمز المكوّن من 6 أرقام الظاهر في تطبيق المصادقة.</p>
      )}
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        dir="ltr"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        aria-label="رمز التحقق"
        className="w-full rounded-lg border border-gold/40 px-4 py-3 text-center text-2xl tracking-[0.5em] focus:border-gold focus:outline-none"
      />
      {error && <p role="alert" className="text-center text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full rounded-lg bg-gold px-4 py-3 font-medium text-white hover:bg-gold-dark disabled:opacity-60"
      >
        {busy ? "جارٍ التحقق…" : "تحقق"}
      </button>
    </form>
  );
}
