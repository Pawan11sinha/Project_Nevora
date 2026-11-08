import { featureLink, safeHref } from "@/lib/features";
import { productsInSubcategory, visibleCategories, visibleCollections } from "@/lib/sample-catalogue";

export type NavData = ReturnType<typeof buildNavigation>;
type NavLink = { href: string; label: string };
const present = (links: (NavLink | null | false | undefined)[]): NavLink[] => links.filter((x): x is NavLink => Boolean(x));

const INFO = [
  { href: "/info/shipping", label: "Shipping" },
  { href: "/info/returns", label: "Returns & Refunds" },
  { href: "/info/contact", label: "Contact" },
  { href: "/info/about", label: "About NÉVORA" },
];

/**
 * Footer groups. Every link goes through src/lib/features.ts or a "has real products" check, so the footer never
 * points at an empty or unfinished page. Gift Sets, Mix & Match and Order Help are left out until they exist.
 */
export function buildFooter() {
  const categories = visibleCategories();
  const jewellery = categories.find((c) => c.slug === "jewellery");
  const hair = categories.find((c) => c.slug === "hair-accessories");
  const sub = (slug: string, label: string) => jewellery && productsInSubcategory(slug).length > 0 && { href: `/categories/jewellery/${slug}`, label };
  const collection = (slug: string, label: string) => visibleCollections("merchandising").some((c) => c.slug === slug) && { href: `/collections/${slug}`, label };
  const groups = [
    { title: "Shop", links: present([
      jewellery && { href: "/categories/jewellery", label: "All Jewellery" },
      sub("earrings", "Earrings"),
      sub("necklaces", "Necklaces"),
      hair && { href: "/categories/hair-accessories", label: "Hair Accessories" },
      collection("new-arrivals", "New Arrivals"),
    ]) },
    { title: "Explore", links: present([
      collection("trending", "Trending"),
      ...visibleCollections("aesthetic").map((c) => ({ href: `/collections/${c.slug}`, label: c.name })),
      ...visibleCollections("price").map((c) => ({ href: `/collections/${c.slug}`, label: c.name })),
      featureLink("collectionsIndex"),
    ]) },
    { title: "Help", links: present([
      { href: "/info/shipping", label: "Shipping" },
      { href: "/info/returns", label: "Returns & Refunds" },
      { href: "/info/contact", label: "Contact" },
      featureLink("faq"),
    ]) },
    { title: "Company", links: [
      { href: "/info/about", label: "About NÉVORA" },
      { href: "/info/privacy", label: "Privacy Policy" },
      { href: "/info/terms", label: "Terms & Conditions" },
    ] },
  ];
  return groups.map((g) => ({ ...g, links: g.links.map((l) => ({ ...l, href: safeHref(l.href) })) })).filter((g) => g.links.length > 0);
}

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
      featureLink("festiveEdit"),
      featureLink("giftBox"),
    ].filter((x): x is { href: string; label: string } => Boolean(x)),
    info: present([...INFO, featureLink("faq")]),
  };
}
