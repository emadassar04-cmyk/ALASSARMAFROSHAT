"use client";
import { useI18n } from "@/components/admin/I18nProvider";
import { fill } from "@/lib/admin/i18n";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteMedia, moveMedia, registerMedia } from "./actions";

type Media = { id: string; url: string; kind: "image" | "video"; alt: string | null };
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 50;

// تصغير الصورة إلى 1600px كحد أقصى وتحويلها إلى WebP قبل الرفع (أسرع للزبائن وأقل تخزيناً)
async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("تعذر تحويل الصورة"))), "image/webp", 0.85));
}

export function MediaManager({ productId, productName, media }: { productId: string; productName: string; media: Media[] }) {
  const { t, tx } = useI18n();
  const P = t.pf;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const images = media.filter((m) => m.kind === "image").length;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const supabase = createClient();
    let count = images;
    for (const [i, file] of Array.from(files).entries()) {
      const isImage = IMAGE_TYPES.includes(file.type);
      const isVideo = VIDEO_TYPES.includes(file.type);
      if (!isImage && !isVideo) { setError(`«${file.name}»: ${P.badType}`); continue; }
      if (isImage && file.size > MAX_IMAGE_MB * 1024 * 1024) { setError(`«${file.name}» ${fill(P.tooBig, { n: MAX_IMAGE_MB })}`); continue; }
      if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) { setError(`«${file.name}» ${fill(P.tooBig, { n: MAX_VIDEO_MB })}`); continue; }
      if (isImage && count >= 10) { setError(P.maxImages); break; }
      setBusy(fill(P.uploading, { i: i + 1, n: files.length }));
      try {
        const body = isImage ? await toWebp(file) : file;
        const ext = isImage ? "webp" : file.type === "video/webm" ? "webm" : "mp4";
        const path = `${productId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("product-media")
          .upload(path, body, { contentType: isImage ? "image/webp" : file.type, cacheControl: "31536000", upsert: false });
        if (upErr) { setError(`${P.uploadFailed} «${file.name}»: ${upErr.message}`); continue; }
        const url = supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
        const res = await registerMedia(productId, url, isImage ? "image" : "video", productName);
        if (res.error) { setError(tx(res.error)); await supabase.storage.from("product-media").remove([path]); continue; }
        if (isImage) count++;
      } catch (e) {
        setError(`«${file.name}»: ${(e as Error).message}`);
      }
    }
    setBusy(null);
    startTransition(() => router.refresh());
  }

  async function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    const res = await fn();
    if (res.error) setError(tx(res.error));
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--a-muted-ink)]">{fill(P.imagesCount, { n: images })}</p>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {media.map((m, i) => (
          <li key={m.id} className="space-y-1">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-beige">
              {m.kind === "image"
                // eslint-disable-next-line @next/next/no-img-element -- معاينة داخل لوحة الإدارة
                ? <img src={m.url} alt={m.alt ?? ""} className="h-full w-full object-cover" />
                : <video src={m.url} className="h-full w-full object-cover" muted />}
              {i === 0 && <span className="absolute start-1 top-1 rounded bg-[var(--a-sidebar)] px-1.5 text-xs text-white">{P.cover}</span>}
            </div>
            <div className="flex justify-between text-xs">
              <button type="button" disabled={i === 0} onClick={() => run(() => moveMedia(m.id, -1))} aria-label={P.moveUp} className="px-1 disabled:opacity-30"><span aria-hidden="true" className="inline-block ltr:rotate-180">→</span></button>
              <button type="button" onClick={() => confirm(P.deleteQ) && run(() => deleteMedia(m.id))} className="font-semibold text-[var(--a-danger-ink)]">{t.common.delete}</button>
              <button type="button" disabled={i === media.length - 1} onClick={() => run(() => moveMedia(m.id, 1))} aria-label={P.moveDown} className="px-1 disabled:opacity-30"><span aria-hidden="true" className="inline-block ltr:rotate-180">←</span></button>
            </div>
          </li>
        ))}
      </ul>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] border border-dashed border-[var(--a-accent)] bg-white px-4 py-3 text-sm font-semibold hover:bg-[#fcfbf8]">
        <input type="file" multiple accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")} className="sr-only"
          disabled={!!busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        {busy ?? `＋ ${P.upload}`}
      </label>
      {error && <p role="alert" className="text-sm text-[var(--a-danger-ink)]">{error}</p>}
    </div>
  );
}
