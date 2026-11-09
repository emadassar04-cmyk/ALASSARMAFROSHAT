"use server";
import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAPS_HOSTS, coordsFromMapsUrl } from "@/lib/maps";

export type FormState = { ok?: boolean; error?: string; note?: string };

// 0594793301 أو +970594793301 ← +970594793301
function normalizePhone(raw: string): string | null | false {
  const s = raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[\s-]/g, "");
  if (!s) return null;
  if (/^05\d{8}$/.test(s)) return `+970${s.slice(1)}`;
  if (/^\+?(970|972)5\d{8}$/.test(s)) return `+${s.replace(/^\+/, "")}`;
  if (/^0\d{8}$/.test(s)) return `+970${s.slice(1)}`; // هاتف أرضي
  return false;
}

// الرابط المختصر (maps.app.goo.gl) يُتبَع حتى الرابط الكامل الذي يحوي الإحداثيات
async function resolveCoords(url: string): Promise<{ lat: number; lng: number } | null> {
  let current = url;
  for (let i = 0; i < 5; i++) {
    const direct = coordsFromMapsUrl(current);
    if (direct) return direct;
    try {
      const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(5000) });
      const next = res.headers.get("location");
      if (!next) return null;
      current = new URL(next, current).toString();
      // لا نتبع أي تحويل يخرج عن نطاقات Google
      if (!MAPS_HOSTS.test(current)) return null;
    } catch {
      return null;
    }
  }
  return coordsFromMapsUrl(current);
}

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};

export async function saveBranch(_: FormState, f: FormData): Promise<FormState> {
  const id = String(f.get("id") ?? "");
  const name = String(f.get("name") ?? "").trim().slice(0, 80);
  const city = String(f.get("city") ?? "").trim().slice(0, 60) || null;
  const address = String(f.get("address") ?? "").trim().slice(0, 200) || null;
  const phone = normalizePhone(String(f.get("phone") ?? ""));
  const mapUrl = String(f.get("map_url") ?? "").trim() || null;
  let lat = num(f.get("lat"));
  let lng = num(f.get("lng"));

  if (name.length < 2) return { error: "اكتب اسم الفرع." };
  if (phone === false) return { error: "رقم الهاتف غير صحيح. مثال: 0594793301" };
  if (mapUrl && !MAPS_HOSTS.test(mapUrl)) return { error: "الصق رابط موقع من Google Maps (يبدأ بـ https://maps.app.goo.gl أو https://www.google.com/maps)." };
  if ((lat === null) !== (lng === null) || (lat !== null && (Number.isNaN(lat) || Number.isNaN(lng!)))) {
    return { error: "أدخل خط العرض وخط الطول معاً، أو اتركهما فارغين." };
  }

  let note: string | undefined;
  // إن لم تُدخل الإحداثيات يدوياً نستخرجها من رابط الخريطة
  if (mapUrl && lat === null) {
    const c = await resolveCoords(mapUrl);
    if (c) ({ lat, lng } = c);
    else note = "حُفظ الرابط، لكن تعذر استخراج الموقع الدقيق منه؛ الخريطة ستبحث بالعنوان المكتوب. يمكنك إدخال الإحداثيات يدوياً.";
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("branches")
    .update({ name, city, address, phone, map_url: mapUrl, lat, lng })
    .eq("id", id).select("id");
  if (error) return { error: /check/i.test(error.message) ? "بعض البيانات غير صالحة." : "تعذر الحفظ." };
  if (!data?.length) return { error: "لا تملك صلاحية تعديل الإعدادات." };
  updateTag("settings");
  return { ok: true, note };
}
