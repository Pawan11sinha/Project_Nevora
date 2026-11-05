import { notFound } from "next/navigation";
import { AddButton } from "@/components/AddButton";
import { ProductImage } from "@/components/ProductImage";
import { formatPrice, PRODUCTS } from "@/lib/sample-data";

// Test 3: product pages cached at build time. No ISR while KV is off.

export function generateStaticParams() {
  return PRODUCTS.slice(0, 8).map((p) => ({ slug: p.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) notFound();
  return (
    <article className="grid gap-6 md:grid-cols-2">
      <ProductImage
        base="/sample/product"
        alt={`${product.name} sample image`}
        priority
        sizes="(min-width: 768px) 50vw, 100vw"
      />
      <div>
        <h1 className="font-serif text-3xl text-[#46372F]">{product.name}</h1>
        <p className="my-2 text-xl">{formatPrice(product.pricePaise)}</p>
        <p>{product.description}</p>
        <AddButton />
      </div>
    </article>
  );
}
