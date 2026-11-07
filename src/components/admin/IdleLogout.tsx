"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// خروج تلقائي بعد مدة خمول (NEXT_PUBLIC_ADMIN_IDLE_MINUTES، الافتراضي 30 دقيقة)
const MINUTES = Number(process.env.NEXT_PUBLIC_ADMIN_IDLE_MINUTES) || 30;
const EVENTS = ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"] as const;
const STORAGE_KEY = "admin-last-activity";

export function IdleLogout() {
  useEffect(() => {
    const limit = MINUTES * 60_000;
    const touch = () => localStorage.setItem(STORAGE_KEY, String(Date.now()));
    touch();
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    // localStorage مشترك بين التبويبات، فالنشاط في أي تبويب يمدد الجلسة
    const timer = window.setInterval(async () => {
      const last = Number(localStorage.getItem(STORAGE_KEY)) || Date.now();
      if (Date.now() - last > limit) {
        window.clearInterval(timer);
        await createClient().auth.signOut();
        window.location.replace("/admin/login?error=idle");
      }
    }, 30_000);

    return () => {
      window.clearInterval(timer);
      EVENTS.forEach((e) => window.removeEventListener(e, touch));
    };
  }, []);
  return null;
}
