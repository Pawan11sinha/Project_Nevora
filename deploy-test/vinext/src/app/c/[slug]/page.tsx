import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/ProductGrid";
import { CATEGORIES, PRODUCTS } from "@/lib/sample-data";

// Test 2: cached category pages that revalidate on a timer.
export const revalidate = 300;

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
