"use client";
import { useEffect } from "react";
import { rememberSource } from "@/lib/store/my-orders";

export function SourceTracker() {
  useEffect(() => { rememberSource(); }, []);
  return null;
}
