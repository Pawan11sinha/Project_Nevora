// Editorial photos for the homepage's Shop by category and Shop by aesthetic cards. These aren't product photos: they
// set the mood of a category or edit. The owner confirmed on 8 Nov 2026 that NÉVORA owns or licenses them.
// Files are pre-sized WebP in public/images/<group>/<name>-<width>w.webp, made by scripts/make-editorial-images.mjs, and
// served as static assets, so they never run the Worker. Alt text says "gold-tone" and "pearl-style": no material claims.

export type EditorialImage = {
  /** Path without the width suffix, e.g. /images/categories/jewellery-gold-tone-flat-lay */
  base: string;
  /** Pre-made widths, smallest first. */
  widths: number[];
  /** The master's dimensions (after any crop), for the aspect ratio the browser reserves before the image loads. */
  width: number;
  height: number;
  alt: string;
  /** CSS object-position, so cropping to the card's shape keeps the subject in frame. */
  position: string;
};

export const CATEGORY_IMAGES: Record<string, EditorialImage> = {
  jewellery: {
    base: "/images/categories/jewellery-gold-tone-flat-lay",
    widths: [480, 800, 1200, 1600],
    width: 1920,
    height: 1081,
    alt: "Gold-tone hoops, rings, a pearl-style bracelet and fine necklaces arranged on ivory marble",
    position: "50% 55%",
  },
  "hair-accessories": {
    base: "/images/categories/hair-accessories-satin-scrunchies-pearl-clips",
    widths: [480, 800, 1200, 1600],
    width: 2048,
    height: 1365,
    alt: "Satin scrunchies in blush and cream with pearl-style hair clips and a gold-tone star claw clip",
    position: "50% 50%",
  },
};

export const AESTHETIC_IMAGES: Record<string, EditorialImage> = {
  "korean-edit": {
    base: "/images/aesthetics/korean-edit-pearl-hair-clips",
    // Cropped from the 1100 × 1100 master to remove its white side margins (scripts/make-editorial-images.mjs).
    widths: [480, 800, 914],
    width: 914,
    height: 1100,
    alt: "Two delicate hair clips worn above the ear with a pearl-style drop earring",
    position: "40% 32%",
  },
  "coquette-edit": {
    base: "/images/aesthetics/coquette-edit-pearl-necklaces",
    widths: [480, 800, 1200, 1600],
    width: 1600,
    height: 1073,
    alt: "Strands of pearl-style necklaces on an ivory plate over cream satin",
    position: "45% 50%",
  },
  "minimal-edit": {
    base: "/images/aesthetics/minimal-edit-gold-tone-travertine",
    widths: [480, 800, 1200],
    width: 1200,
    height: 686,
    alt: "A gold-tone pendant necklace, ring and hoops displayed on travertine blocks",
    position: "50% 50%",
  },
};

export const srcOf = (image: EditorialImage, width: number) => `${image.base}-${width}w.webp`;
export const srcSetOf = (image: EditorialImage) => image.widths.map((w) => `${srcOf(image, w)} ${w}w`).join(", ");
