// يُعاد تركيب هذا الغلاف عند كل انتقال بين صفحات المتجر، فتظهر الصفحة الجديدة بتلاشٍ هادئ (انظر .page-enter)،
// بينما يبقى الرأس والتذييل (في layout.tsx) ثابتين.
export default function StoreTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
