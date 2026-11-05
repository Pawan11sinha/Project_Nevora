// SAMPLE DATA for the deployment test only. These aren't real products or prices.
export type SampleProduct = {
  slug: string;
  name: string;
  category: string;
  pricePaise: number;
  description: string;
};

const NAMES = [
  "Oxidised Jhumka",
  "Pearl Stud",
  "Gold-Tone Huggie",
  "Pendant Necklace",
  "Layered Necklace",
  "Charm Bracelet",
  "Claw Clip",
  "Satin Scrunchie Pack",
];

export const CATEGORIES = [
  { slug: "earrings", name: "Earrings" },
  { slug: "necklaces", name: "Necklaces" },
  { slug: "bracelets", name: "Bracelets" },
  { slug: "hair", name: "Hair accessories" },
];

// 48 products, so listing pages render a realistic amount of markup.
export const PRODUCTS: SampleProduct[] = Array.from({ length: 48 }, (_, i) => {
  const name = NAMES[i % NAMES.length];
  return {
    slug: `sample-${i + 1}`,
    name: `Sample ${name} ${i + 1}`,
    category: CATEGORIES[i % CATEGORIES.length].slug,
    pricePaise: 14900 + (i % 8) * 5000,
    description: `Sample description for the deployment test, for ${name}. Not a real product.`,
  };
});

export const formatPrice = (paise: number) => `₹${(paise / 100).toFixed(0)}`;
