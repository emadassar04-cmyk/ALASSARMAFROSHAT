"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "../I18nProvider";

export type Point = { t: string; orders: number; revenue: number; profit: number; created?: number; customers?: number; net?: number };
type Unit = "hour" | "day" | "month";
type Metric = "revenue" | "orders" | "profit";

import { CHART } from "./palette";
export type { Point as ChartPoint };

const H = 260, P = { t: 16, r: 12, b: 30, l: 56 };

// عرض الرسم = عرض الحاوية الفعلي (حتى لا يصغر النص في البطاقات الضيقة)
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, W: w };
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function useScale(values: number[], integer = false) {
  const raw = niceMax(Math.max(0, ...values));
  // الأعداد (الطلبات) بخطوات صحيحة فقط
  const max = integer ? Math.max(4, Math.ceil(Math.max(0, ...values) / 4) * 4) : raw;
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);
  return { max, y, ticks };
}

function Axis({ W, ticks, y, format, labels, x }: { W: number; ticks: number[]; y: (v: number) => number; format: (v: number) => string; labels: { i: number; text: string }[]; x: (i: number) => number }) {
  return (
    <>
      {ticks.map((tk) => (
        <g key={tk}>
          <line x1={P.l} x2={W - P.r} y1={y(tk)} y2={y(tk)} stroke={CHART.grid} strokeWidth={1} />
          <text x={P.l - 8} y={y(tk)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.axis}>{format(tk)}</text>
        </g>
      ))}
      {labels.map((l) => (
        <text key={l.i} x={x(l.i)} y={H - 8} textAnchor="middle" fontSize={11} fill={CHART.axis}>{l.text}</text>
      ))}
    </>
  );
}

function tickLabels(n: number, label: (i: number) => string, W: number) {
  const every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor((W - P.l) / 70))));
  return Array.from({ length: n }, (_, i) => i).filter((i) => i % every === 0 || i === n - 1 && n <= 12).map((i) => ({ i, text: label(i) }));
}

// جدول بديل للرسم (إمكانية الوصول والطباعة)
function DataTable({ rows, cols }: { rows: { label: string; values: string[] }[]; cols: string[] }) {
  const { t } = useI18n();
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-[var(--a-accent-ink)]">{t.common.showTable}</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-[10px] border border-[var(--a-line)]">
        <table className="a-table">
          <thead><tr><th scope="col">{t.common.date}</th>{cols.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td>{r.values.map((v, i) => <td key={i} className="tabular-nums">{v}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

// خط الاتجاه: الفترة الحالية (خط + مساحة خفيفة) مقابل الفترة السابقة (خط متقطع)، مع مؤشر وتلميح عند المرور
export function TrendChart({ series, previous, unit, metric = "revenue", label }: {
  series: Point[]; previous: Point[]; unit: Unit; metric?: Metric; label: string;
}) {
  const { t, f } = useI18n();
  const gid = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const { ref, W } = useWidth();
  const money = metric !== "orders";
  const cur = series.map((p) => Number(p[metric]));
  const prev = series.map((_, i) => Number(previous[i]?.[metric] ?? 0));
  const { y, ticks } = useScale([...cur, ...prev], metric === "orders");
  const n = series.length;
  const x = (i: number) => (n <= 1 ? (P.l + W - P.r) / 2 : P.l + (i * (W - P.l - P.r)) / (n - 1));
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${path(cur)}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const fv = (v: number) => (money ? f.money(v) : f.number(v));
  const axisFmt = (v: number) => (money ? f.compactMoney(v) : f.number(v));
  const lbl = (i: number) => f.bucket(series[i].t, unit);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  }
  const a = active;

  return (
    <figure>
      <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--a-muted-ink)]">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-5 rounded" style={{ background: CHART.current }} />{t.dashboard.currentPeriod}</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="w-5 border-t-2 border-dashed" style={{ borderColor: CHART.previous }} />{t.dashboard.previousPeriod}</span>
      </div>
      <div ref={ref} className="relative" dir="ltr">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-[260px] w-full touch-pan-y select-none" role="img" aria-label={label}
          onPointerMove={onMove} onPointerLeave={() => setActive(null)} onPointerDown={onMove}>
          <defs>
            <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={CHART.area} stopOpacity={0.32} />
              <stop offset="100%" stopColor={CHART.area} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Axis W={W} ticks={ticks} y={y} format={axisFmt} x={x} labels={tickLabels(n, lbl, W)} />
          <path d={area} fill={`url(#g${gid})`} />
          <path d={path(prev)} fill="none" stroke={CHART.previous} strokeWidth={2} strokeDasharray="5 5" strokeLinejoin="round" />
          <path d={path(cur)} fill="none" stroke={CHART.current} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {/* نقاط على المنحنى للفترات القصيرة (حتى 31 نقطة) */}
          {n <= 31 && cur.map((v, i) => v > 0 && (
            <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill="#fff" stroke={CHART.current} strokeWidth={2} pointerEvents="none" />
          ))}
          {a !== null && (
            <g pointerEvents="none">
              <line x1={x(a)} x2={x(a)} y1={P.t} y2={H - P.b} stroke="#c9c3b6" strokeWidth={1} />
              <circle cx={x(a)} cy={y(prev[a])} r={4} fill="#fff" stroke={CHART.previous} strokeWidth={2} />
              <circle cx={x(a)} cy={y(cur[a])} r={5} fill={CHART.current} stroke="#fff" strokeWidth={2} />
            </g>
          )}
        </svg>
        {a !== null && (
          <div role="status" className="pointer-events-none absolute top-1 z-10 min-w-40 rounded-[10px] border border-[var(--a-line)] bg-white px-3 py-2 text-xs shadow-[var(--a-shadow-lg)]"
            style={{ left: `${(x(a) / W) * 100}%`, transform: `translateX(${x(a) > W * 0.6 ? "-105%" : "8px"})` }}>
            <p className="mb-1 font-semibold">{lbl(a)}</p>
            <p className="flex justify-between gap-4"><span className="text-[var(--a-muted-ink)]">{t.dashboard.currentPeriod}</span><b className="tabular-nums">{fv(cur[a])}</b></p>
            <p className="flex justify-between gap-4"><span className="text-[var(--a-muted-ink)]">{t.dashboard.previousPeriod}</span><span className="tabular-nums">{fv(prev[a])}</span></p>
          </div>
        )}
      </div>
      <DataTable cols={[t.dashboard.currentPeriod, t.dashboard.previousPeriod]}
        rows={series.map((p, i) => ({ label: lbl(i), values: [fv(cur[i]), fv(prev[i])] }))} />
    </figure>
  );
}

// أعمدة رفيعة لسلسلة واحدة (الطلبات أو الربح) مع تلميح عند المرور/التركيز
export function BarChart({ series, unit, metric, label, color = CHART.bars }: {
  series: Point[]; unit: Unit; metric: Metric; label: string; color?: string;
}) {
  const { f } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const { ref, W } = useWidth();
  const vals = useMemo(() => series.map((p) => Number(p[metric])), [series, metric]);
  const { y, ticks } = useScale(vals, metric === "orders");
  const n = series.length;
  const step = (W - P.l - P.r) / Math.max(1, n);
  const bw = Math.max(2, Math.min(22, step - 2));
  const x = (i: number) => P.l + i * step + step / 2;
  const money = metric !== "orders";
  const fv = (v: number) => (money ? f.money(v) : f.number(v));
  const lbl = (i: number) => f.bucket(series[i].t, unit);
  const a = active;

  return (
    <figure>
      <div ref={ref} className="relative" dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-[260px] w-full select-none" role="img" aria-label={label} onPointerLeave={() => setActive(null)}>
          <Axis W={W} ticks={ticks} y={y} format={(v) => (money ? f.compactMoney(v) : f.number(v))} x={x} labels={tickLabels(n, lbl, W)} />
          {vals.map((v, i) => {
            const top = y(v), h = Math.max(0, y(0) - top);
            const r = Math.min(4, bw / 2, h);
            const x0 = x(i) - bw / 2;
            return (
              <g key={series[i].t}>
                {h > 0 && (
                  <path d={`M${x0},${y(0)}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${y(0)}Z`}
                    fill={color} opacity={a === null || a === i ? 1 : 0.4} />
                )}
                <rect x={P.l + i * step} y={P.t} width={step} height={H - P.t - P.b} fill="transparent" tabIndex={0}
                  aria-label={`${lbl(i)}: ${fv(v)}`} onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} />
              </g>
            );
          })}
        </svg>
        {a !== null && (
          <div role="status" className="pointer-events-none absolute top-1 z-10 rounded-[10px] border border-[var(--a-line)] bg-white px-3 py-2 text-xs shadow-[var(--a-shadow-lg)]"
            style={{ left: `${(x(a) / W) * 100}%`, transform: `translateX(${x(a) > W * 0.6 ? "-105%" : "8px"})` }}>
            <p className="font-semibold">{lbl(a)}</p>
            <p className="tabular-nums">{fv(vals[a])}</p>
          </div>
        )}
      </div>
      <DataTable cols={[label]} rows={series.map((p, i) => ({ label: lbl(i), values: [fv(vals[i])] }))} />
    </figure>
  );
}
