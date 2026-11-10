"use client";
import { useEffect, useRef, useState } from "react";

// قائمة منبثقة بسيطة: تُغلق بالنقر خارجها أو Esc، وتعيد التركيز للزر
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return { open, setOpen, ref, button };
}

export const iconBtn = "relative grid h-10 w-10 place-items-center rounded-full border border-[var(--a-line)] bg-white text-[var(--a-text)] transition-colors hover:border-[#d5cfc2] hover:bg-[#faf8f4]";
export const popPanel = "absolute end-0 top-[calc(100%+0.5rem)] z-50 rounded-[14px] border border-[var(--a-line)] bg-white shadow-[var(--a-shadow-lg)]";
