import Link from "next/link";
import { ProductImage } from "@/components/catalogue/ProductImage";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { type Art, COLLECTIONS, productsInCollection } from "@/lib/sample-catalogue";

export const metadata = { title: "All collections (sample)" };

// Every collection that has real products, grouped. Empty ones (such as Festive Edit before festive stock arrives)
// stay out, exactly as in the navigation.
const GROUPS = [
  { group: "merchandising", title: "Edits" },
  { group: "aesthetic", title: "Shop by aesthetic" },
  { group: "price", title: "Shop by price" },
] as const;

export default function CollectionsIndexPage() {
  const sections = GROUPS.map((g) => ({
    ...g,
    collections: COLLECTIONS.filter((c) => c.group === g.group)
      .map((c) => ({ ...c, products: productsInCollection(c) }))
      .filter((c) => c.products.length > 0),
  })).filter((g) => g.collections.length > 0);
  // A different piece on each card where possible, so the page doesn't repeat one image.
  const used = new Set<Art>();
  const coverArt = (products: { art: Art }[]) => {
    const art = (products.find((p) => !used.has(p.art)) ?? products[0]).art;
    used.add(art);
    return art;
  };
  const covers = new Map(sections.flatMap((s) => s.collections).map((c) => [c.slug, coverArt(c.products)]));

  return (
    <main className="mx-auto max-w-7xl px-5 pb-6 pt-5 lg:px-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Collections" }]} />
      <h1 className="mt-5 font-serif text-title font-medium leading-[1.05]">All collections</h1>
      {sections.map((s) => (
        <section key={s.group} aria-labelledby={`group-${s.group}`} className="mt-10">
          <h2 id={`group-${s.group}`} className="font-serif text-heading font-medium">{s.title}</h2>
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
            {s.collections.map((c) => (
              <li key={c.slug}>
                <Link prefetch={false} href={`/collections/${c.slug}`} className="group block">
                  <div className="overflow-hidden rounded-xl">
                    <div className="transition-transform duration-500 ease-gentle group-hover:scale-[1.03]">
                      <ProductImage art={covers.get(c.slug)!} alt="" sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw" />
                    </div>
                  </div>
                  <p className="mt-3 font-serif text-lg font-medium leading-tight group-hover:underline group-hover:decoration-gold group-hover:underline-offset-4">{c.name}</p>
                  <p className="mt-1 text-sm text-ink-soft">{c.products.length} sample {c.products.length === 1 ? "piece" : "pieces"}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
