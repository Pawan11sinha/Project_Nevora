import { visibleCategories, visibleCollections } from "@/lib/sample-catalogue";

export type NavData = ReturnType<typeof buildNavigation>;

const INFO = [
  { href: "/info/shipping", label: "Shipping" },
  { href: "/info/returns", label: "Returns & Refunds" },
  { href: "/info/contact", label: "Contact" },
  { href: "/info/about", label: "About NÉVORA" },
];

export function buildNavigation() {
  const merchandising = visibleCollections("merchandising");
  const find = (slug: string) => merchandising.find((c) => c.slug === slug);
  return {
    categories: visibleCategories().map((c) => ({
      name: c.name,
      href: `/categories/${c.slug}`,
      links: c.subcategories.map((s) => ({ href: `/categories/${c.slug}/${s.slug}`, label: s.name })),
    })),
    aesthetics: visibleCollections("aesthetic").map((c) => ({ href: `/collections/${c.slug}`, label: c.name })),
    prices: visibleCollections("price").map((c) => ({ href: `/collections/${c.slug}`, label: c.name })),
    // Each one appears only when it has real products.
    primary: [
      find("new-arrivals") && { href: "/collections/new-arrivals", label: "New Arrivals" },
      find("trending") && { href: "/collections/trending", label: "Trending" },
      find("festive-edit") && { href: "/collections/festive-edit", label: "Festive Edit" },
      find("gift-box") && { href: "/collections/gift-box", label: "Gift Box" },
    ].filter((x): x is { href: string; label: string } => Boolean(x)),
    info: INFO,
  };
}
