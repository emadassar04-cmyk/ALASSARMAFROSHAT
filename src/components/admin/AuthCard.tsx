export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-beige px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gold/30 bg-white p-8 shadow-sm">
        <p className="text-center text-sm text-gold-dark">مفروشات العصار</p>
        <h1 className="mt-1 mb-6 text-center text-2xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
