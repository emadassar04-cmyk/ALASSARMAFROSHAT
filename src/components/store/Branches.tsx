import { MapPin, Navigation, Phone } from "lucide-react";
import type { Branch } from "@/lib/catalog-types";
import { whatsappLink } from "@/lib/format";
import { directionsUrl, displayPhone, embedUrl, telHref } from "@/lib/maps";
import { MapEmbed } from "./MapEmbed";
import { WhatsAppIcon } from "./WhatsAppIcon";

// بطاقات الفروع: خريطة (تُحمَّل عند الطلب) + العنوان + اتصال + WhatsApp + الاتجاهات. كل البيانات من قاعدة البيانات.
export function BranchCards({ branches, autoloadMaps = false }: { branches: Branch[]; autoloadMaps?: boolean }) {
  if (!branches.length) return null;
  return (
    <ul className={`grid gap-6 ${branches.length > 1 ? "md:grid-cols-2" : "max-w-2xl"}`}>
      {branches.map((b) => {
        const wa = b.phone ? whatsappLink(b.phone, `مرحباً، أستفسر عن ${b.name}`) : null;
        return (
          <li key={b.id} className="reveal panel flex flex-col overflow-hidden shadow-soft">
            <div className="relative aspect-[16/10] border-b border-border">
              <MapEmbed src={embedUrl(b)} title={`موقع ${b.name} على الخريطة`} autoload={autoloadMaps} />
            </div>
            <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl text-charcoal">{b.name}</h3>
                {b.is_main && <span className="rounded-full bg-charcoal px-2.5 py-0.5 text-[0.72rem] font-medium text-warm-white">الفرع الرئيسي</span>}
              </div>
              <ul className="space-y-2.5 text-[0.95rem] text-muted-ink">
                {(b.address || b.city) && (
                  <li className="flex items-start gap-2.5">
                    <MapPin aria-hidden="true" strokeWidth={1.6} className="mt-1 h-[1.1rem] w-[1.1rem] shrink-0 text-gold-ink" />
                    <span>{[b.city, b.address].filter(Boolean).join(" – ")}</span>
                  </li>
                )}
                {b.phone && (
                  <li className="flex items-center gap-2.5">
                    <Phone aria-hidden="true" strokeWidth={1.6} className="h-[1.1rem] w-[1.1rem] shrink-0 text-gold-ink" />
                    <a href={telHref(b.phone)} dir="ltr" className="tabular-nums text-charcoal hover:underline">{displayPhone(b.phone)}</a>
                  </li>
                )}
              </ul>
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <a href={directionsUrl(b)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  <Navigation aria-hidden="true" strokeWidth={1.6} className="h-4 w-4" />الاتجاهات
                </a>
                {b.phone && (
                  <a href={telHref(b.phone)} className="btn btn-outline" aria-label={`اتصل بـ ${b.name}`}>
                    <Phone aria-hidden="true" strokeWidth={1.6} className="h-4 w-4" />اتصال
                  </a>
                )}
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp" aria-label={`WhatsApp ${b.name}`}>
                    <WhatsAppIcon className="h-4 w-4" />WhatsApp
                  </a>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// بيانات منظمة لكل فرع (Store + PostalAddress + GeoCoordinates)
export function branchLd(b: Branch) {
  return {
    "@type": "HomeGoodsStore",
    name: `مفروشات العصار – ${b.name}`,
    ...(b.phone && { telephone: b.phone.replace(/\s/g, "") }),
    hasMap: directionsUrl(b),
    address: {
      "@type": "PostalAddress",
      addressCountry: "PS",
      ...(b.city && { addressLocality: b.city }),
      ...(b.address && { streetAddress: b.address }),
    },
    ...(b.lat !== null && b.lng !== null && { geo: { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng } }),
  };
}
