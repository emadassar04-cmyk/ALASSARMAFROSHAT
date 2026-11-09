"use client";
import { useEffect, useState } from "react";

// عدّاد حقيقي حتى تاريخ نهاية الحملة (لا يظهر إن لم تبدأ الحملة أو انتهت)
function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ start, end, tone = "dark" }: { start: string; end: string; tone?: "dark" | "light" }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.requestAnimationFrame(tick);
    const t = window.setInterval(tick, 1000);
    return () => { window.cancelAnimationFrame(first); window.clearInterval(t); };
  }, []);
  if (now === null) return <div className="h-16" aria-hidden="true" />;
  const s = new Date(start).getTime(), e = new Date(end).getTime();
  if (now < s) {
    return <p className="text-sm">تبدأ الحملة {new Date(start).toLocaleDateString("ar", { numberingSystem: "latn", timeZone: "Asia/Gaza", dateStyle: "long" })}</p>;
  }
  if (now >= e) return <p className="text-sm">انتهت فترة الحملة، وسيُعلن الفائز قريباً.</p>;
  const p = parts(e - now);
  const box = tone === "light" ? "bg-white/10 text-warm-white" : "bg-cream text-charcoal";
  return (
    <div role="timer" aria-label={`متبقٍ ${p.d} يوم و${p.h} ساعة و${p.m} دقيقة`} className="flex gap-2" dir="rtl">
      {([["يوم", p.d], ["ساعة", p.h], ["دقيقة", p.m], ["ثانية", p.s]] as const).map(([label, v]) => (
        <div key={label} className={`min-w-14 rounded-[var(--radius-control)] px-2 py-2 text-center ${box}`}>
          <span className="block font-display text-2xl tabular-nums">{String(v).padStart(2, "0")}</span>
          <span className="block text-[0.7rem] opacity-80">{label}</span>
        </div>
      ))}
    </div>
  );
}
