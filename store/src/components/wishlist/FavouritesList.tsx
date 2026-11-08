"use client";

import { ProductGrid } from "@/components/catalogue/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { findProduct, type Product } from "@/lib/sample-catalogue";
import { useFavourites } from "./favourites-store";

// The Favourites page contents, read from this browser's storage. Products that no longer exist drop out quietly.
export function FavouritesList() {
  const slugs = useFavourites();
  if (slugs === null) {
    return (
      <>
        <p className="mt-6 text-ink-soft">Loading your favourites&hellip;</p>
        <noscript><p className="mt-2 text-sm">Favourites need JavaScript turned on in your browser.</p></noscript>
      </>
    );
  }
  const products = slugs.map(findProduct).filter((p): p is Product => Boolean(p));
  if (products.length === 0) {
    return (
      <div className="mt-6">
        <p className="text-lg">You haven&rsquo;t saved any favourites yet.</p>
        <p className="mt-1 text-ink-soft">Tap the heart on any piece to keep it here. Favourites are saved in this browser only.</p>
        <div className="mt-6"><ButtonLink href="/">Continue shopping</ButtonLink></div>
      </div>
    );
  }
  return (
    <>
      <p className="mt-2 text-sm text-ink-soft">{products.length} {products.length === 1 ? "piece" : "pieces"}, saved in this browser only.</p>
      <div className="mt-7"><ProductGrid products={products} /></div>
    </>
  );
}
