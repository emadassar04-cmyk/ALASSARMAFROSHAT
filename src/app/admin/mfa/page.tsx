import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/AuthCard";
import { MfaForm } from "./MfaForm";
import { signOut } from "../actions";

export const metadata: Metadata = { title: "التحقق بخطوتين", robots: { index: false, follow: false } };

export default function MfaPage() {
  return (
    <AuthCard title="التحقق بخطوتين">
      <MfaForm />
      <form action={signOut} className="mt-6 text-center">
        <button className="text-sm underline opacity-70">تسجيل الخروج</button>
      </form>
    </AuthCard>
  );
}
