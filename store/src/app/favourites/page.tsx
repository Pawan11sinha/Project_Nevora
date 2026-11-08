import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { FavouritesList } from "@/components/wishlist/FavouritesList";

export const metadata: Metadata = { title: "Favourites (sample)" };

// Favourites are read from this browser's storage, so the page itself is the same for everyone and can be static.
export default function FavouritesPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 pb-16 pt-5 lg:px-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Favourites" }]} />
      <h1 className="mt-5 font-serif text-title font-medium leading-[1.05]">Favourites</h1>
      <FavouritesList />
    </main>
  );
}
