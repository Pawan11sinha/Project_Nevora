import Link from "next/link";
import { ProductGrid } from "@/components/catalogue/ProductCard";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { StaticHero } from "@/components/home/StaticHero";
import { ButtonLink } from "@/components/ui/Button";
import { EditorialImage } from "@/components/ui/EditorialImage";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AESTHETIC_IMAGES, CATEGORY_IMAGES } from "@/lib/editorial-images";
import { MAX_LIVE_SLIDES, SAMPLE_CAMPAIGNS } from "@/lib/sample-campaigns";
import { COLLECTIONS, productsInCollection, visibleCategories, visibleCollections } from "@/lib/sample-catalogue";

const inCollection = (slug: string) => productsInCollection(COLLECTIONS.find((c) => c.slug === slug)!);

export default function HomePage() {
  const newArrivals = inCollection("new-arrivals").slice(0, 4);
  const picks = inCollection("trending").slice(0, 4);
  const aesthetics = visibleCollections("aesthetic");
  const prices = visibleCollections("price");
  const categories = visibleCategories();
  const heroSlides = SAMPLE_CAMPAIGNS.slice(0, MAX_LIVE_SLIDES);

  return (
    <main>
      {/* Hero: the campaign carousel when banners are live, otherwise the original NÉVORA hero. Banners are labelled
          samples until the banner manager (M4b) replaces them with published campaigns. */}
      {heroSlides.length > 0 ? <HeroCarousel slides={heroSlides} /> : <StaticHero showNewArrivals={newArrivals.length > 0} />}

      {/* Categories */}
      <section aria-labelledby="categories-title" className="border-y border-line bg-cream">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
          <div className="reveal">
            <SectionHeading id="categories-title" title="Shop by category" />
            {/* Editorial photo cards. The espresso scrim covers only the lower part, where the text sits, so the text
                keeps its contrast on light photos. Portrait on phones, so the text stays in the darkest part of the
                scrim; landscape from tablet up. The whole card is one link to the category. */}
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:gap-6">
              {categories.map((c) => {
                const image = CATEGORY_IMAGES[c.slug];
                return (
                  <li key={c.slug}>
                    <Link prefetch={false} href={`/categories/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-espresso sm:aspect-[4/3]">
                      {image && <EditorialImage image={image} sizes="(min-width: 1280px) 616px, (min-width: 640px) 50vw, 100vw" className="transition-transform duration-700 ease-gentle group-hover:scale-[1.03]" />}
                      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-[linear-gradient(to_top,rgb(52_37_31/0.88)_0%,rgb(52_37_31/0.62)_42%,rgb(52_37_31/0)_100%)]" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-ivory sm:p-6 lg:p-8">
                        <h3 className="font-serif text-heading font-medium leading-tight">{c.name}</h3>
                        <p className="mt-1 max-w-sm text-sm leading-relaxed text-ivory/90">{c.intro}</p>
                        <span className="mt-3 inline-flex min-h-6 items-center gap-2 text-sm font-semibold tracking-wide underline-offset-4 group-hover:underline group-hover:decoration-gold">
                          Shop now<span aria-hidden="true" className="transition-transform duration-300 ease-gentle group-hover:translate-x-1">&rarr;</span>
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
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
              {/* One photo per edit, the same shape in every card: landscape when stacked on phones, portrait in three
                  columns from tablet up. The text sits below the photo, on espresso, so it needs no scrim. */}
              <ul className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-4 lg:gap-6">
                {aesthetics.map((c) => {
                  const image = AESTHETIC_IMAGES[c.slug];
                  return (
                    <li key={c.slug}>
                      <Link prefetch={false} href={`/collections/${c.slug}`} className="group block">
                        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-espresso-deep sm:aspect-[4/5]">
                          {image && <EditorialImage image={image} sizes="(min-width: 1280px) 400px, (min-width: 640px) 33vw, 100vw" className="transition-transform duration-700 ease-gentle group-hover:scale-[1.04]" />}
                        </div>
                        <h3 className="mt-4 font-serif text-heading font-medium italic group-hover:underline group-hover:decoration-gold group-hover:underline-offset-4">{c.name}</h3>
                        <p className="mt-0.5 text-sm text-[#e4dacd]">{c.intro}</p>
                      </Link>
                    </li>
                  );
                })}
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
