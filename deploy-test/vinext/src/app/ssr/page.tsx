import { ProductGrid } from "@/components/ProductGrid";
import { PRODUCTS } from "@/lib/sample-data";

// Test 4: worst case. Full server render of a large listing on every request.
export const dynamic = "force-dynamic";

export default function SsrPage() {
  return (
    <>
      <h1 className="font-serif text-3xl text-[#46372F]">Server-rendered page</h1>
      <p className="my-2 text-sm">Rendered at {new Date().toISOString()}</p>
      <ProductGrid products={PRODUCTS} />
    </>
  );
}
