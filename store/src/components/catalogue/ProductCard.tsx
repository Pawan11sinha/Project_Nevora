import Link from "next/link";
import { formatPrice, type Product } from "@/lib/sample-catalogue";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product, priority = false, showLabel = true }: { product: Product; priority?: boolean; showLabel?: boolean }) {
  const label = product.soldOut ? "Sold out" : showLabel ? product.pickLabel : undefined;
  return (
    <article className="group relative">
      <Link prefetch={false} href={`/products/${product.slug}`} className="block">
        <div className="relative overflow-hidden">
          <div className={`transition-transform duration-500 ease-gentle group-hover:scale-[1.03] ${product.soldOut ? "opacity-60" : ""}`}>
            <ProductImage art={product.art} alt={`${product.name}, sample image`} priority={priority} />
          </div>
          {label && <span className="absolute left-2.5 top-2.5 bg-ivory px-2.5 py-1 text-[11px] font-semibold tracking-wide">{label}</span>}
        </div>
        <h3 className="mt-3 font-serif text-[1.2rem] font-medium leading-snug group-hover:underline group-hover:decoration-gold group-hover:underline-offset-4">{product.name}</h3>
      </Link>
      <p className="mt-0.5 text-sm font-medium">{formatPrice(product.pricePaise)}</p>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0, showLabel = true }: { products: Product[]; priorityCount?: number; showLabel?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
      {products.map((p, i) => (
        <li key={p.slug}><ProductCard product={p} priority={i < priorityCount} showLabel={showLabel} /></li>
      ))}
    </ul>
  );
}
