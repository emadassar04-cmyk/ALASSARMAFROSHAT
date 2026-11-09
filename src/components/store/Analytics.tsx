import Script from "next/script";
import { getStoreSettings } from "@/lib/catalog";
import { PixelPageViews } from "./PixelPageViews";

// يُحمَّل فقط إن أُدخل المعرّف من لوحة الإدارة (التسويق وSEO). لا يعمل في صفحات الإدارة.
// المعرّفات مقيدة بصيغة صارمة في قاعدة البيانات، لذا إدراجها في السكربت آمن.
export async function Analytics() {
  const { ga_measurement_id: ga, meta_pixel_id: pixel } = await getStoreSettings();
  if (!ga && !pixel) return null;
  return (
    <>
      {ga && (
        <>
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="lazyOnload" />
        </>
      )}
      {pixel && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');`}
          </Script>
          <PixelPageViews />
        </>
      )}
    </>
  );
}
