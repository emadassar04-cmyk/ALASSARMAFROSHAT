"use client";
// إشعارات خفيفة: toast("أُضيف إلى المفضلة") من أي مكوّن عميل، ويعرضها <Toaster /> الموجود في تخطيط المتجر
export type ToastTone = "success" | "info" | "error";
export const TOAST_EVENT = "alassar:toast";

export function toast(message: string, tone: ToastTone = "success") {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, tone } }));
}
