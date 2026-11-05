import Link from "next/link";
import { ProductGrid } from "@/components/ProductGrid";
import { CATEGORIES, PRODUCTS } from "@/lib/sample-data";

// Test 1: a statically generated home page.
export default function Home() {
  return (
    <>
      <h1 className="font-serif text-3xl text-[#46372F]">Static home page</h1>
      <ul className="my-4 flex flex-wrap gap-3">
        {CATEGORIES.map((c) => (
          <li key={c.slug}>
            <Link href={`/c/${c.slug}`} prefetch={false} className="underline">
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
      <ProductGrid products={PRODUCTS.slice(0, 24)} />
    </>
  );
}
