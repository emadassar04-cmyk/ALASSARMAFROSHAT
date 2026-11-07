"use client";
import { useState } from "react";
import { formatPrice } from "@/lib/format";

type Day = { day: string; orders: number; revenue: number };

// أعمدة رفيعة لسلسلة واحدة (المبيعات اليومية): ذهبي، أطراف مدوّرة، شبكة خافتة، تلميح عند المرور/التركيز
export function DailyBars({ data }: { data: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Number(d.revenue)));
  const W = 720, H = 220, PAD = { t: 12, b: 28, l: 8, r: 8 };
  const step = (W - PAD.l - PAD.r) / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(18, step - 2));
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const label = (iso: string) => iso.slice(5).replace("-", "/");
  const a = active !== null ? data[active] : null;

  return (
    <figure className="space-y-2">
      {/* سطر التلميح فوق الرسم (لا يغطي الأعمدة)، بارتفاع ثابت حتى لا تقفز الصفحة */}
      <p role="status" className="h-6 text-sm" aria-live="polite">
        {a ? <><b>{a.day}</b> — {formatPrice(a.revenue)} · {a.orders} طلب</> : <span className="opacity-50">مرّر على عمود لرؤية تفاصيل اليوم</span>}
      </p>
      <div className="relative" dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-label="المبيعات اليومية (انظر الجدول للأرقام)"
          onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#e7e1d6" strokeWidth={1} />
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.l + i * step + (step - bw) / 2;
            const top = y(Number(d.revenue));
            const h = Math.max(0, H - PAD.b - top);
            return (
              <g key={d.day}>
                {/* هدف المرور أكبر من العمود */}
                <rect x={PAD.l + i * step} y={PAD.t} width={step} height={H - PAD.t - PAD.b} fill="transparent"
                  onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} tabIndex={0}
                  aria-label={`${d.day}: ${formatPrice(d.revenue)}، ${d.orders} طلب`} />
                {h > 0 && <rect x={x} y={top} width={bw} height={h} rx={Math.min(4, bw / 2)} fill="#b8923a"
                  opacity={active === null || active === i ? 1 : 0.45} pointerEvents="none" />}
                {(data.length <= 14 || i % Math.ceil(data.length / 10) === 0) && (
                  <text x={PAD.l + i * step + step / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#6b6255">{label(d.day)}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="text-xs opacity-70">أعلى قيمة: {formatPrice(max)}. الأرقام كاملة في جدول الأيام.</figcaption>
    </figure>
  );
}
