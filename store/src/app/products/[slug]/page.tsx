import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/catalogue/ProductCard";
import { ProductImage } from "@/components/catalogue/ProductImage";
import { AddToBag } from "@/components/product/AddToBag";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PRODUCTS, categoryOf, findProduct, formatPrice, productsInSubcategory, subcategoryName } from "@/lib/sample-catalogue";

export const dynamicParams = false;
export const generateStaticParams = () => PRODUCTS.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${findProduct(slug)?.name ?? "Product"} (sample)` };
}

const details = (material: string, description: string) => [
  { title: "Details", body: description },
  { title: "Material", body: material },
  { title: "Care", body: "Sample care note. Real care instructions replace this." },
  { title: "Shipping & returns", body: "Sample text. Real delivery times and return terms are added after courier and legal review." },
];

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = findProduct(slug);
  if (!product) notFound();
  const category = categoryOf(product);
  const sameType = productsInSubcategory(product.subcategory).filter((p) => p.slug !== slug);
  const sameLook = PRODUCTS.filter((p) => p.slug !== slug && !sameType.includes(p) && p.aesthetics.some((a) => product.aesthetics.includes(a)));
  const sameCategory = PRODUCTS.filter((p) => p.slug !== slug && !sameType.includes(p) && !sameLook.includes(p) && categoryOf(p)?.slug === category?.slug);
  const related = [...sameType, ...sameLook, ...sameCategory].slice(0, 4);

  return (
    <main className="mx-auto max-w-7xl px-5 pb-6 pt-5 lg:px-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, ...(category ? [{ href: `/categories/${category.slug}`, label: category.name }] : []), { href: category ? `/categories/${category.slug}/${product.subcategory}` : undefined, label: subcategoryName(product.subcategory) }, { label: product.name }]} />
      <div className="mt-5 grid gap-8 md:grid-cols-2 lg:gap-14">
        <div className={product.soldOut ? "opacity-70" : ""}>
          <ProductImage art={product.art} alt={`${product.name}, sample image`} priority sizes="(min-width: 768px) 50vw, 100vw" />
        </div>
        <div className="md:sticky md:top-28 md:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-deep">{subcategoryName(product.subcategory)}</p>
          <h1 className="mt-2 font-serif text-title font-medium leading-[1.05]">{product.name}</h1>
          <p className="mt-3 text-xl font-medium">{formatPrice(product.pricePaise)}<span className="ml-2 align-middle text-xs font-normal text-ink-soft">Sample price</span></p>
          <p className="mt-2 text-sm font-medium">{product.soldOut ? "Sold out" : "In stock"}</p>
          {/* The bag lives in the browser. Checkout, which will recalculate prices on the server, isn't built yet. */}
          <AddToBag slug={product.slug} name={product.name} finishes={product.finishes} soldOut={product.soldOut} />
          <div className="mt-7 border-t border-line">
            {details(product.material, product.description).map((d, i) => (
              <details key={d.title} open={i === 0} className="group border-b border-line">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  {d.title}
                  <span aria-hidden="true" className="text-lg font-normal group-open:hidden">+</span>
                  <span aria-hidden="true" className="hidden text-lg font-normal group-open:inline">&minus;</span>
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-ink-soft">{d.body}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section aria-labelledby="related-title" className="mt-16 lg:mt-24">
          <SectionHeading id="related-title" title="You may also like" />
          <div className="mt-7"><ProductGrid products={related} showLabel={false} /></div>
        </section>
      )}
    </main>
  );
}
