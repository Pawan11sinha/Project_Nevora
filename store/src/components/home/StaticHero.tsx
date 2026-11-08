import { ProductImage } from "@/components/catalogue/ProductImage";
import { ButtonLink } from "@/components/ui/Button";

// The original NÉVORA hero. It's the fallback whenever no campaign banner is live.
export function StaticHero({ showNewArrivals }: { showNewArrivals: boolean }) {
  return (
    /* Hero: text first on phones, so the message is immediately readable. */
    <section aria-labelledby="hero-title" className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-14 pt-10 md:grid-cols-2 md:gap-14 md:pb-20 md:pt-16 lg:px-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-deep">Jewellery &amp; hair accessories</p>
        <h1 id="hero-title" className="mt-4 font-serif text-display font-medium leading-[0.98]">
          Your everyday <em className="font-normal">kind of</em> shine.
        </h1>
        <p className="mt-5 max-w-md leading-relaxed text-ink-soft">Small details for real days: soft pearls, easy hoops and the clip you&rsquo;ll keep reaching for.</p>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          {showNewArrivals && <ButtonLink href="/collections/new-arrivals">Shop new arrivals</ButtonLink>}
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
  );
}
