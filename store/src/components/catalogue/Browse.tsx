"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/sample-catalogue";
import { ProductGrid } from "./ProductCard";

type Sort = "featured" | "low" | "high";
const PRICE_FILTERS = [
  { value: "all", label: "All prices", max: Infinity },
  { value: "299", label: "Under ₹299", max: 29900 },
  { value: "499", label: "Under ₹499", max: 49900 },
];

// The server renders the full list, so it's cached and complete without JavaScript.
// Filtering and sorting then happen in the browser, with no server requests.
export function Browse({ products, showLabel = true }: { products: Product[]; showLabel?: boolean }) {
  const [sort, setSort] = useState<Sort>("featured");
  const [price, setPrice] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);

  const shown = useMemo(() => {
    const max = PRICE_FILTERS.find((f) => f.value === price)?.max ?? Infinity;
    const list = products.filter((p) => p.pricePaise <= max && (!inStockOnly || !p.soldOut));
    if (sort === "low") return [...list].sort((a, b) => a.pricePaise - b.pricePaise);
    if (sort === "high") return [...list].sort((a, b) => b.pricePaise - a.pricePaise);
    return list;
  }, [products, sort, price, inStockOnly]);

  const fieldClass = "min-h-11 border border-control bg-ivory px-3 text-sm";
  return (
    <>
      <form className="flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-line py-3" onSubmit={(e) => e.preventDefault()} aria-label="Filter and sort">
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="filter-price" className="font-medium">Price</label>
          <select id="filter-price" value={price} onChange={(e) => setPrice(e.target.value)} className={fieldClass}>
            {PRICE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="size-5 accent-espresso" />
          In stock
        </label>
        <div className="flex items-center gap-2 text-sm sm:ml-auto">
          <label htmlFor="filter-sort" className="font-medium">Sort</label>
          <select id="filter-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={fieldClass}>
            <option value="featured">Featured</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </div>
      </form>
      <h2 className="sr-only">Products</h2>
      <p role="status" className="mt-4 text-sm text-ink-soft">{shown.length} {shown.length === 1 ? "piece" : "pieces"}</p>
      <div className="mt-5">
        {shown.length > 0 ? (
          <ProductGrid products={shown} priorityCount={4} showLabel={showLabel} />
        ) : (
          <p className="py-16 text-center text-ink-soft">Nothing matches these filters. Try removing one.</p>
        )}
      </div>
    </>
  );
}
