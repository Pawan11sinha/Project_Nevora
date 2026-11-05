import Link from "next/link";
import { AddButton } from "./AddButton";
import { ProductImage } from "./ProductImage";
import { formatPrice, type SampleProduct } from "@/lib/sample-data";

export function ProductGrid({ products }: { products: SampleProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {products.map((p) => (
        <li key={p.slug} className="rounded-lg bg-[#E9DCCF] p-3">
          {/* Prefetch is off on listing pages, to avoid extra Worker requests. */}
          <Link href={`/p/${p.slug}`} prefetch={false}>
            <ProductImage
              base="/sample/product"
              alt={`${p.name} sample image`}
              sizes="(min-width: 768px) 25vw, 50vw"
            />
            <h3 className="mt-2 font-serif text-[#46372F]">{p.name}</h3>
          </Link>
          <p className="text-sm">{formatPrice(p.pricePaise)}</p>
          <AddButton />
        </li>
      ))}
    </ul>
  );
}
