import type { Metadata } from "next";
import { SavedList } from "./SavedList";

export const metadata: Metadata = { title: "المفضلة", robots: { index: false } };

export default function WishlistPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">المفضلة</h1>
      <SavedList />
    </div>
  );
}
