"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode =
  | { kind: "loading" }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string }
  | { kind: "error"; message: string };

export type MfaLabels = { loading: string; factorsFailed: string; enrollFailed: string; badCode: string; firstTime: string; scan: string; qrAlt: string; manual: string; enterCode: string; codeLabel: string; verifying: string; verify: string };

export function MfaForm({ L }: { L: MfaLabels }) {
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
      if (error) return setMode({ kind: "error", message: L.factorsFailed });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setMode({ kind: "verify", factorId: verified.id });

      // إزالة أي تسجيل سابق لم يكتمل، ثم بدء تسجيل جديد
      for (const f of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "لوحة الإدارة" });
      if (enrolled.error) {
        return setMode({ kind: "error", message: L.enrollFailed });
      }
      setMode({
        kind: "enroll",
        factorId: enrolled.data.id,
        qr: enrolled.data.totp.qr_code,
        secret: enrolled.data.totp.secret,
      });
    })();
  }, [router, L.enrollFailed, L.factorsFailed]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode.kind !== "enroll" && mode.kind !== "verify") return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code });
    if (error) {
      setError(L.badCode);
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

  if (mode.kind === "loading") return <p className="text-center" aria-live="polite">{L.loading}</p>;
  if (mode.kind === "error") return <p role="alert" className="text-center text-[var(--a-danger-ink)]">{mode.message}</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode.kind === "enroll" ? (
        <div className="space-y-3 text-sm">
          <p>
            <strong>{L.firstTime}</strong> {L.scan}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- رمز QR بصيغة SVG من Supabase */}
          <img src={mode.qr} alt={L.qrAlt} className="mx-auto h-48 w-48 rounded bg-white p-2" />
          <details className="rounded-[10px] border border-[var(--a-line)] p-2">
            <summary className="cursor-pointer">{L.manual}</summary>
            <code dir="ltr" className="mt-2 block break-all text-center">{mode.secret}</code>
          </details>
        </div>
      ) : (
        <p className="text-sm">{L.enterCode}</p>
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
        aria-label={L.codeLabel}
        className="a-input py-3 text-center text-2xl tracking-[0.5em]"
      />
      {error && <p role="alert" className="text-center text-sm text-[var(--a-danger-ink)]">{error}</p>}
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="a-btn a-btn-primary w-full py-3 text-base"
      >
        {busy ? L.verifying : L.verify}
      </button>
    </form>
  );
}
