"use client";
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
      if (!isImage && !isVideo) { setError(`«${file.name}»: نوع غير مدعوم. الصور: JPG/PNG/WebP/AVIF، الفيديو: MP4/WebM.`); continue; }
      if (isImage && file.size > MAX_IMAGE_MB * 1024 * 1024) { setError(`«${file.name}» أكبر من ${MAX_IMAGE_MB}MB.`); continue; }
      if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) { setError(`«${file.name}» أكبر من ${MAX_VIDEO_MB}MB.`); continue; }
      if (isImage && count >= 10) { setError("الحد الأقصى 10 صور للمنتج."); break; }
      setBusy(`جارٍ رفع ${i + 1} من ${files.length}…`);
      try {
        const body = isImage ? await toWebp(file) : file;
        const ext = isImage ? "webp" : file.type === "video/webm" ? "webm" : "mp4";
        const path = `${productId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("product-media")
          .upload(path, body, { contentType: isImage ? "image/webp" : file.type, cacheControl: "31536000", upsert: false });
        if (upErr) { setError(`فشل رفع «${file.name}»: ${upErr.message}`); continue; }
        const url = supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
        const res = await registerMedia(productId, url, isImage ? "image" : "video", productName);
        if (res.error) { setError(res.error); await supabase.storage.from("product-media").remove([path]); continue; }
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
    if (res.error) setError(res.error);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <p className="text-sm opacity-70">الصور: {images} من 10 (يُفضَّل 5 صور على الأقل). أول صورة هي صورة الغلاف.</p>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {media.map((m, i) => (
          <li key={m.id} className="space-y-1">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-beige">
              {m.kind === "image"
                // eslint-disable-next-line @next/next/no-img-element -- معاينة داخل لوحة الإدارة
                ? <img src={m.url} alt={m.alt ?? ""} className="h-full w-full object-cover" />
                : <video src={m.url} className="h-full w-full object-cover" muted />}
              {i === 0 && <span className="absolute top-1 right-1 rounded bg-charcoal px-1.5 text-xs text-white">الغلاف</span>}
            </div>
            <div className="flex justify-between text-xs">
              <button type="button" disabled={i === 0} onClick={() => run(() => moveMedia(m.id, -1))} aria-label="تقديم" className="px-1 disabled:opacity-30">→</button>
              <button type="button" onClick={() => confirm("حذف هذا الملف نهائياً؟") && run(() => deleteMedia(m.id))} className="text-red-700">حذف</button>
              <button type="button" disabled={i === media.length - 1} onClick={() => run(() => moveMedia(m.id, 1))} aria-label="تأخير" className="px-1 disabled:opacity-30">←</button>
            </div>
          </li>
        ))}
      </ul>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gold px-4 py-3 text-sm hover:bg-beige">
        <input type="file" multiple accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")} className="sr-only"
          disabled={!!busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        {busy ?? "＋ رفع صور أو فيديو"}
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
