import Link from "next/link";
import { ProductGrid } from "@/components/catalogue/ProductCard";
import { ProductImage } from "@/components/catalogue/ProductImage";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { COLLECTIONS, productsInCategory, productsInCollection, visibleCategories, visibleCollections } from "@/lib/sample-catalogue";

const inCollection = (slug: string) => productsInCollection(COLLECTIONS.find((c) => c.slug === slug)!);

const aestheticArt = { "korean-edit": "clip", "coquette-edit": "bow", "minimal-edit": "hoop" } as const;
const categoryArt = { jewellery: "chandbali", "hair-accessories": "claw" } as const;

export default function HomePage() {
  const newArrivals = inCollection("new-arrivals").slice(0, 4);
  const picks = inCollection("trending").slice(0, 4);
  const aesthetics = visibleCollections("aesthetic");
  const prices = visibleCollections("price");
  const categories = visibleCategories();

  return (
    <main>
      {/* Hero: text first on phones, so the message is immediately readable. */}
      <section aria-labelledby="hero-title" className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-14 pt-10 md:grid-cols-2 md:gap-14 md:pb-20 md:pt-16 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-deep">Jewellery &amp; hair accessories</p>
          <h1 id="hero-title" className="mt-4 font-serif text-display font-medium leading-[0.98]">
            Your everyday <em className="font-normal">kind of</em> shine.
          </h1>
          <p className="mt-5 max-w-md leading-relaxed text-ink-soft">Small details for real days: soft pearls, easy hoops and the clip you&rsquo;ll keep reaching for.</p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            {newArrivals.length > 0 && <ButtonLink href="/collections/new-arrivals">Shop new arrivals</ButtonLink>}
            <ButtonLink href="/collections/korean-edit" variant="secondary">Find your look</ButtonLink>
          </div>
        </div>
        <div className="grid grid-cols-[3fr_2fr] items-end gap-3">
          <ProductImage art="layered" alt="Layered necklace, sample image" priority sizes="(min-width: 768px) 30vw, 60vw" />
          <div className="space-y-3">
            <ProductImage art="chandbali" alt="Chandbali earrings, sample image" priority sizes="(min-width: 768px) 20vw, 40vw" />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="categories-title" className="border-y border-line bg-cream">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
          <div className="reveal">
            <SectionHeading id="categories-title" title="Shop by category" />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:gap-6">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link prefetch={false} href={`/categories/${c.slug}`} className="group grid grid-cols-[2fr_3fr] items-center gap-5 bg-ivory p-3 pr-5">
                    <div className="overflow-hidden"><div className="transition-transform duration-500 ease-gentle group-hover:scale-[1.04]"><ProductImage art={categoryArt[c.slug as keyof typeof categoryArt]} alt="" sizes="(min-width: 640px) 18vw, 40vw" /></div></div>
                    <div>
                      <h3 className="font-serif text-heading font-medium leading-tight group-hover:underline group-hover:decoration-gold group-hover:underline-offset-4">{c.name}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{c.intro}</p>
                      <p className="mt-2 text-xs text-ink-soft">{productsInCategory(c.slug).length} sample pieces</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* New arrivals */}
      {newArrivals.length > 0 && (
        <section aria-labelledby="new-title" className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
          <div className="reveal">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading id="new-title" eyebrow="Just in" title="New arrivals" />
              <ButtonLink href="/collections/new-arrivals" variant="quiet">View all</ButtonLink>
            </div>
            <div className="mt-8"><ProductGrid products={newArrivals} showLabel={false} /></div>
          </div>
        </section>
      )}

      {/* Shop by aesthetic */}
      {aesthetics.length > 0 && (
        <section aria-labelledby="aesthetic-title" className="bg-espresso text-ivory">
          <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d9c49c]">Find your look</p>
            <h2 id="aesthetic-title" className="mt-2 font-serif text-title font-medium leading-[1.05]">Shop by aesthetic</h2>
            <div className="reveal">
              <ul className="mt-8 grid gap-4 sm:grid-cols-3 lg:gap-6">
                {aesthetics.map((c) => (
                  <li key={c.slug}>
                    <Link prefetch={false} href={`/collections/${c.slug}`} className="group grid grid-cols-[6.5rem_1fr] items-center gap-4 sm:block">
                      <div className="overflow-hidden"><div className="transition-transform duration-500 ease-gentle group-hover:scale-[1.03]"><ProductImage art={aestheticArt[c.slug as keyof typeof aestheticArt]} alt="" sizes="(min-width: 640px) 30vw, 30vw" /></div></div>
                      <div>
                        <h3 className="font-serif text-heading font-medium italic group-hover:underline group-hover:decoration-gold group-hover:underline-offset-4 sm:mt-3">{c.name}</h3>
                        <p className="mt-0.5 text-sm text-[#e4dacd]">{c.intro}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Manually chosen picks: no sales or popularity claims. */}
      {picks.length > 0 && (
        <section aria-labelledby="trending-title" className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
          <div className="reveal">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading id="trending-title" eyebrow="Hand-picked" title="Trending now" intro="Chosen by hand by our team. These picks aren't based on sales numbers." />
              <ButtonLink href="/collections/trending" variant="quiet">View all</ButtonLink>
            </div>
            <div className="mt-8"><ProductGrid products={picks} /></div>
          </div>
        </section>
      )}

      {/* Price points */}
      {prices.length > 0 && (
        <section aria-labelledby="price-title" className="mx-auto max-w-7xl px-5 pb-6 lg:px-8">
          <h2 id="price-title" className="sr-only">Shop by price</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:gap-6">
            {prices.map((c) => (
              <li key={c.slug}>
                <Link prefetch={false} href={`/collections/${c.slug}`} className="group flex min-h-40 flex-col justify-between border border-line p-6 transition-colors duration-300 hover:bg-cream lg:p-8">
                  <span className="font-serif text-title font-medium leading-none">{c.name}</span>
                  <span className="mt-6 flex items-center justify-between text-sm text-ink-soft">{c.intro}<span aria-hidden="true" className="ml-3 transition-transform duration-300 ease-gentle group-hover:translate-x-1">&rarr;</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
