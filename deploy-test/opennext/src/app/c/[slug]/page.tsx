import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/ProductGrid";
import { CATEGORIES, PRODUCTS } from "@/lib/sample-data";

// Test 2: category pages cached at build time. No ISR while KV is off, because the
// read-only cache can't store a refreshed page.

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) notFound();
  return (
    <>
      <h1 className="font-serif text-3xl text-[#46372F]">{category.name}</h1>
      <p className="my-2 text-sm">Generated at {new Date().toISOString()}</p>
      <ProductGrid products={PRODUCTS.filter((p) => p.category === slug)} />
    </>
  );
}
