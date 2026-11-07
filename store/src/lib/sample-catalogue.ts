// SAMPLE DATA for the local prototype. These aren't real products, prices or stock.
// The real store reads all of this from the database. Nothing here reaches production.
export type Art = "jhumka" | "chandbali" | "hoop" | "stud" | "necklace" | "layered" | "ring" | "bracelet" | "claw" | "clip" | "scrunchie" | "bow" | "headband";
export type Aesthetic = "korean-edit" | "coquette-edit" | "minimal-edit";

export type Product = {
  slug: string;
  name: string;
  subcategory: string;
  pricePaise: number;
  material: string;
  description: string;
  finishes: string[];
  art: Art;
  aesthetics: Aesthetic[];
  isNew?: boolean;
  /** A manual pick. The label is an editorial choice, never a sales or popularity claim. */
  pickLabel?: string;
  soldOut?: boolean;
};

export type Subcategory = { slug: string; name: string };
export type Category = { slug: string; name: string; intro: string; subcategories: Subcategory[] };
export type Collection = { slug: string; name: string; group: "aesthetic" | "price" | "merchandising"; intro: string; includes: (p: Product) => boolean };

export const CATEGORIES: Category[] = [
  {
    slug: "jewellery",
    name: "Jewellery",
    intro: "Everyday pieces with a quiet shine, from small studs to statement jhumkas.",
    subcategories: [
      { slug: "earrings", name: "Earrings" },
      { slug: "hoops-studs", name: "Hoops & Studs" },
      { slug: "jhumkas-chandbalis", name: "Jhumkas & Chandbalis" },
      { slug: "necklaces", name: "Necklaces" },
      { slug: "rings", name: "Rings" },
      { slug: "bracelets", name: "Bracelets" },
      { slug: "anklets", name: "Anklets" },
    ],
  },
  {
    slug: "hair-accessories",
    name: "Hair Accessories",
    intro: "Clips, bows and soft scrunchies that finish a look in seconds.",
    subcategories: [
      { slug: "claw-clips", name: "Claw Clips" },
      { slug: "korean-hair-clips", name: "Korean Hair Clips" },
      { slug: "scrunchies", name: "Scrunchies" },
      { slug: "hair-bows", name: "Hair Bows" },
      { slug: "headbands", name: "Headbands" },
    ],
  },
];

const p = (slug: string, name: string, subcategory: string, rupees: number, art: Art, aesthetics: Aesthetic[], extra: Partial<Product> = {}): Product => ({
  slug,
  name,
  subcategory,
  pricePaise: rupees * 100,
  art,
  aesthetics,
  material: "Sample material. Real material details are confirmed with the supplier.",
  description: "Sample description for the prototype. Real product details, dimensions and care notes replace this.",
  finishes: ["Gold tone"],
  ...extra,
});

export const PRODUCTS: Product[] = [
  p("sample-dome-jhumka", "Dome Jhumka", "jhumkas-chandbalis", 249, "jhumka", [], { finishes: ["Oxidised silver tone", "Gold tone"], isNew: true, pickLabel: "Editor's Pick" }),
  p("sample-pearl-chandbali", "Pearl Chandbali", "jhumkas-chandbalis", 349, "chandbali", ["coquette-edit"], { isNew: true }),
  p("sample-everyday-hoop", "Everyday Hoop", "hoops-studs", 229, "hoop", ["minimal-edit", "korean-edit"], { finishes: ["Gold tone", "Silver tone"], pickLabel: "Editor's Pick" }),
  p("sample-pearl-stud", "Pearl Stud", "hoops-studs", 179, "stud", ["minimal-edit", "coquette-edit", "korean-edit"], { isNew: true }),
  p("sample-drop-earring", "Soft Drop Earring", "earrings", 279, "stud", ["coquette-edit"]),
  p("sample-fine-pendant", "Fine Pendant Necklace", "necklaces", 329, "necklace", ["minimal-edit"], { isNew: true, pickLabel: "Editor's Pick" }),
  p("sample-layered-chain", "Layered Pearl Chain", "necklaces", 449, "layered", ["korean-edit", "coquette-edit"]),
  p("sample-solitaire-ring", "Solitaire Ring", "rings", 199, "ring", ["minimal-edit"], { finishes: ["Gold tone", "Silver tone"] }),
  p("sample-charm-bracelet", "Charm Bracelet", "bracelets", 279, "bracelet", ["coquette-edit"], { soldOut: true }),
  p("sample-matte-claw", "Matte Claw Clip", "claw-clips", 169, "claw", ["minimal-edit", "korean-edit"], { finishes: ["Taupe", "Espresso", "Cream"], isNew: true, pickLabel: "Editor's Pick" }),
  p("sample-large-claw", "Large Claw Clip", "claw-clips", 199, "claw", ["minimal-edit"], { finishes: ["Taupe", "Espresso"] }),
  p("sample-pearl-clip", "Pearl Bar Clip", "korean-hair-clips", 149, "clip", ["korean-edit", "coquette-edit"], { isNew: true }),
  p("sample-satin-scrunchie", "Satin Scrunchie Set", "scrunchies", 169, "scrunchie", ["korean-edit"], { finishes: ["Blush", "Taupe"] }),
  p("sample-ribbon-bow", "Ribbon Hair Bow", "hair-bows", 149, "bow", ["coquette-edit"], { pickLabel: "Editor's Pick" }),
  p("sample-soft-headband", "Soft Padded Headband", "headbands", 199, "headband", ["korean-edit", "minimal-edit"]),
];

export const COLLECTIONS: Collection[] = [
  { slug: "korean-edit", name: "Korean Edit", group: "aesthetic", intro: "Soft, clean and a little playful.", includes: (x) => x.aesthetics.includes("korean-edit") },
  { slug: "coquette-edit", name: "Coquette Edit", group: "aesthetic", intro: "Pearls, bows and romantic details.", includes: (x) => x.aesthetics.includes("coquette-edit") },
  { slug: "minimal-edit", name: "Minimal Edit", group: "aesthetic", intro: "Simple shapes for every day.", includes: (x) => x.aesthetics.includes("minimal-edit") },
  { slug: "under-299", name: "Under ₹299", group: "price", intro: "Small treats at ₹299 or less.", includes: (x) => x.pricePaise <= 29900 },
  { slug: "under-499", name: "Under ₹499", group: "price", intro: "Everything at ₹499 or less.", includes: (x) => x.pricePaise <= 49900 },
  { slug: "new-arrivals", name: "New Arrivals", group: "merchandising", intro: "The latest additions.", includes: (x) => Boolean(x.isNew) },
  { slug: "trending", name: "Trending Now", group: "merchandising", intro: "Chosen by hand by our team. These picks aren't based on sales numbers.", includes: (x) => Boolean(x.pickLabel) },
  { slug: "festive-edit", name: "Festive Edit", group: "merchandising", intro: "Festival pieces.", includes: () => false },
  { slug: "gift-box", name: "Gift Box", group: "merchandising", intro: "Gift-ready sets.", includes: () => false },
];

const category = (x: Product) => CATEGORIES.find((c) => c.subcategories.some((s) => s.slug === x.subcategory));
export const productsInCategory = (slug: string) => PRODUCTS.filter((x) => category(x)?.slug === slug);
export const productsInSubcategory = (slug: string) => PRODUCTS.filter((x) => x.subcategory === slug);
export const productsInCollection = (c: Collection) => PRODUCTS.filter(c.includes);
export const findProduct = (slug: string) => PRODUCTS.find((x) => x.slug === slug);
export const findCollection = (slug: string) => COLLECTIONS.find((c) => c.slug === slug);
export const findCategory = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
export const categoryOf = category;
export const subcategoryName = (slug: string) => CATEGORIES.flatMap((c) => c.subcategories).find((s) => s.slug === slug)?.name ?? slug;

/** Nothing with no real products appears in navigation. */
export const visibleCategories = () =>
  CATEGORIES.map((c) => ({ ...c, subcategories: c.subcategories.filter((s) => productsInSubcategory(s.slug).length > 0) })).filter((c) => c.subcategories.length > 0);
export const visibleCollections = (group: Collection["group"]) => COLLECTIONS.filter((c) => c.group === group && productsInCollection(c).length > 0);
export const formatPrice = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
