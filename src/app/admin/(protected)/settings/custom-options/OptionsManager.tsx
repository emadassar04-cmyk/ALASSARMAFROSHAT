"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/admin/I18nProvider";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/ui";
import { addOption, deleteOption, updateOption } from "./actions";

export type Fabric = { id: string; product_type: "curtains" | "ceiling" | "mattress" | "other"; name: string; texture_url: string | null; is_active: boolean; sort_order: number };
export type Color = { id: string; name: string; hex: string; is_active: boolean; sort_order: number };
const TYPES = ["curtains", "ceiling", "mattress", "other"] as const;
const MAX_MB = 5;

// رفع صورة القماش إلى مخزن الصور (نفس مخزن صور المنتجات، مجلد fabrics) بصلاحية الكتالوج
async function uploadFabricPhoto(file: File): Promise<{ url?: string; error?: string }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { error: "type" };
  if (file.size > MAX_MB * 1024 * 1024) return { error: "size" };
  const supabase = createClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `fabrics/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-media").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) return { error: error.message };
  return { url: supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl };
}

export function OptionsManager({ fabrics, colors }: { fabrics: Fabric[]; colors: Color[] }) {
  const { t, tx } = useI18n();
  const C = t.cop;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newFabric, setNewFabric] = useState<Record<string, string>>({});
  const [newColor, setNewColor] = useState({ name: "", hex: "#d9c7a7" });
  const [busy, setBusy] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    setMsg(null);
    const r = await fn();
    setMsg(r.ok ? { ok: true, text: C.saved } : { ok: false, text: r.error === "forbidden" ? t.errors.forbidden : tx(r.error ?? t.errors.generic) });
    if (r.ok) router.refresh();
  });
  const photo = (id: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    setBusy(id);
    const up = await uploadFabricPhoto(f);
    setBusy(null);
    if (!up.url) return setMsg({ ok: false, text: up.error === "size" ? C.tooBig : up.error === "type" ? C.photoHint : up.error ?? t.errors.generic });
    run(() => updateOption("custom_fabrics", id, { texture_url: up.url! }));
  };

  return (
    <div className="space-y-6">
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-[var(--a-success)]" : "text-[var(--a-danger-ink)]"}`}>{msg.text}</p>}
      <p className="text-sm text-[var(--a-muted-ink)]">{C.note} {C.photoHint}</p>

      {TYPES.map((type) => {
        const list = fabrics.filter((f) => f.product_type === type);
        return (
          <Card key={type} title={`${C.fabrics} — ${C.types[type]}`}>
            {list.length === 0 && <p className="text-sm text-[var(--a-muted-ink)]">{C.none}</p>}
            <ul className="divide-y divide-[var(--a-line)]">
              {list.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- صورة قماش من مخزن الصور */}
                  {f.texture_url ? <img src={f.texture_url} alt="" className="h-11 w-11 rounded-full border border-[var(--a-line)] object-cover" /> : <span className="h-11 w-11 rounded-full border border-dashed border-[var(--a-line)]" />}
                  <input defaultValue={f.name} aria-label={C.name} className="a-input min-w-40 flex-1" onBlur={(e) => e.target.value.trim() !== f.name && run(() => updateOption("custom_fabrics", f.id, { name: e.target.value }))} />
                  <input type="number" defaultValue={f.sort_order} aria-label={C.sort} className="a-input w-20" onBlur={(e) => Number(e.target.value) !== f.sort_order && run(() => updateOption("custom_fabrics", f.id, { sort_order: Number(e.target.value) }))} />
                  <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" defaultChecked={f.is_active} onChange={(e) => run(() => updateOption("custom_fabrics", f.id, { is_active: e.target.checked }))} />{C.active}</label>
                  <label className="a-btn a-btn-ghost min-h-9 cursor-pointer px-3 text-xs">
                    <ImagePlus aria-hidden="true" className="h-4 w-4" />{busy === f.id ? C.uploading : C.upload}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={photo(f.id)} />
                  </label>
                  {f.texture_url && <button type="button" className="a-btn a-btn-ghost min-h-9 px-3 text-xs" onClick={() => run(() => updateOption("custom_fabrics", f.id, { texture_url: null }))}>{C.removePhoto}</button>}
                  <button type="button" aria-label={`${C.remove}: ${f.name}`} className="a-btn a-btn-danger min-h-9 px-3" onClick={() => confirm(C.confirmDelete) && run(() => deleteOption("custom_fabrics", f.id))}><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const name = newFabric[type] ?? ""; run(async () => { const r = await addOption("custom_fabrics", { product_type: type, name }); if (r.ok) setNewFabric((s) => ({ ...s, [type]: "" })); return r; }); }}>
              <input value={newFabric[type] ?? ""} onChange={(e) => setNewFabric((s) => ({ ...s, [type]: e.target.value }))} placeholder={C.name} aria-label={`${C.addFabric} — ${C.types[type]}`} className="a-input min-w-48 flex-1" maxLength={60} />
              <button disabled={pending || !(newFabric[type] ?? "").trim()} className="a-btn a-btn-primary">{C.addFabric}</button>
            </form>
          </Card>
        );
      })}

      <Card title={C.colors}>
        <ul className="divide-y divide-[var(--a-line)]">
          {colors.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <input type="color" defaultValue={c.hex} aria-label={`${C.hex}: ${c.name}`} className="h-11 w-11 cursor-pointer rounded-full border border-[var(--a-line)] bg-transparent" onBlur={(e) => e.target.value !== c.hex && run(() => updateOption("custom_colors", c.id, { hex: e.target.value }))} />
              <input defaultValue={c.name} aria-label={C.name} className="a-input min-w-40 flex-1" onBlur={(e) => e.target.value.trim() !== c.name && run(() => updateOption("custom_colors", c.id, { name: e.target.value }))} />
              <input type="number" defaultValue={c.sort_order} aria-label={C.sort} className="a-input w-20" onBlur={(e) => Number(e.target.value) !== c.sort_order && run(() => updateOption("custom_colors", c.id, { sort_order: Number(e.target.value) }))} />
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" defaultChecked={c.is_active} onChange={(e) => run(() => updateOption("custom_colors", c.id, { is_active: e.target.checked }))} />{C.active}</label>
              <button type="button" aria-label={`${C.remove}: ${c.name}`} className="a-btn a-btn-danger min-h-9 px-3" onClick={() => confirm(C.confirmDelete) && run(() => deleteOption("custom_colors", c.id))}><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await addOption("custom_colors", newColor); if (r.ok) setNewColor({ name: "", hex: "#d9c7a7" }); return r; }); }}>
          <input type="color" value={newColor.hex} onChange={(e) => setNewColor((s) => ({ ...s, hex: e.target.value }))} aria-label={C.hex} className="h-11 w-11 cursor-pointer rounded-full border border-[var(--a-line)] bg-transparent" />
          <input value={newColor.name} onChange={(e) => setNewColor((s) => ({ ...s, name: e.target.value }))} placeholder={C.name} aria-label={C.addColor} className="a-input min-w-48 flex-1" maxLength={40} />
          <button disabled={pending || !newColor.name.trim()} className="a-btn a-btn-primary">{C.addColor}</button>
        </form>
      </Card>
    </div>
  );
}
