import Link from "next/link";
import { FavouriteButton } from "@/components/wishlist/FavouriteButton";
import { formatPrice, productImages, type Product } from "@/lib/sample-catalogue";
import { CardAddToBag } from "./CardAddToBag";
import { DiscountBadge, PriceComparison } from "./PriceComparison";
import { ProductImage } from "./ProductImage";

// Product card: a large rounded image with the discount (if genuine) top-left and the favourite heart top-right,
// a serif title, the selling price with any struck-through MRP, and Add to bag at the bottom so cards in a row line up.
// The image and title link to the product; the heart and Add to bag sit outside those links, so they never open it.
// Promotional badges such as Buy 2 Get 1 aren't shown: they arrive only with real, active M11 campaigns.
export function ProductCard({ product, priority = false, showLabel = true }: { product: Product; priority?: boolean; showLabel?: boolean }) {
  const label = product.soldOut ? "Sold out" : showLabel ? product.pickLabel : undefined;
  const href = `/products/${product.slug}`;
  // The hover image is the product's second image by gallery order, as in the real store (product_images.sort_order).
  const second = productImages(product)[1];
  return (
    <article className="group flex h-full flex-col rounded-2xl bg-[#fffdf9] p-2 shadow-[0_1px_2px_rgba(52,37,31,0.05)] ring-1 ring-line/60 transition-shadow duration-300 ease-gentle hover:shadow-[0_10px_28px_rgba(52,37,31,0.10)] sm:p-2.5">
      <div className="relative overflow-hidden rounded-xl bg-cream">
        {/* The image repeats the title link, so it's hidden from screen readers and skipped by Tab. */}
        <Link prefetch={false} href={href} tabIndex={-1} aria-hidden="true" className="block">
          <div className={`relative transition-transform duration-700 ease-gentle group-hover:scale-[1.04] ${product.soldOut ? "opacity-60" : ""}`}>
            <ProductImage art={product.art} alt="" priority={priority} />
            {/* The second image fades in on hover, only on devices with a real pointer. Elsewhere it's display:none,
                so phones never download it. Products with one image simply keep it. */}
            {second && (
              <ProductImage
                art={product.art}
                view={second.view}
                alt=""
                className="absolute inset-0 hidden h-full opacity-0 transition-opacity duration-500 ease-gentle group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:block"
              />
            )}
          </div>
        </Link>
        <DiscountBadge pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} className="pointer-events-none absolute left-2.5 top-2.5" />
        {label && (
          <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full bg-ivory/95 px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-sm">
            {label}
          </span>
        )}
        <FavouriteButton slug={product.slug} name={product.name} className="absolute right-2 top-2" />
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3 sm:px-1.5">
        <h3 className="font-serif text-[1.12rem] font-medium leading-[1.3] sm:text-[1.2rem]">
          {/* Full-width, so the whole title area is a comfortable tap target, clamped to two lines. */}
          <Link prefetch={false} href={href} className="line-clamp-2 py-0.5 hover:underline hover:decoration-gold hover:underline-offset-4">{product.name}</Link>
        </h3>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-base font-semibold"><span className="sr-only">Price </span>{formatPrice(product.pricePaise)}</p>
          <PriceComparison pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} badge={false} className="text-sm" />
        </div>
        {/* mt-auto pushes the button to the bottom, so cards in a row line up whatever the title length. */}
        <div className="mt-auto pt-3">
          <CardAddToBag product={product} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0, showLabel = true }: { products: Product[]; priorityCount?: number; showLabel?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-8">
      {products.map((p, i) => (
        <li key={p.slug}><ProductCard product={p} priority={i < priorityCount} showLabel={showLabel} /></li>
      ))}
    </ul>
  );
}
