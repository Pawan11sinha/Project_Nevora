// SAMPLE campaign banners for the homepage hero prototype (roadmap M4b, design first).
// These are not real offers or live promotions. In M4b they're replaced by banners the admin publishes from the
// banner manager; until then this local file is the only source. Artwork: scripts/make-campaign-art.mjs.

export const ROTATION_MS = 5000;
export const MAX_LIVE_SLIDES = 3;

export type Campaign = {
  id: string;
  /** Shown on every slide so nobody mistakes a sample for a real offer. */
  sampleLabel: string;
  eyebrow: string;
  heading: string;
  description: string;
  cta: string;
  /** An existing NÉVORA route; tests/sample-campaigns.test.mjs checks it resolves to real products. */
  href: string;
  image: { desktop: string; mobile: string; alt: string };
};

const art = (name: string) => ({ desktop: `/sample/campaign/${name}-desktop.svg`, mobile: `/sample/campaign/${name}-mobile.svg` });

export const SAMPLE_CAMPAIGNS: Campaign[] = [
  {
    id: "new-arrivals",
    sampleLabel: "Sample campaign",
    eyebrow: "New arrivals",
    heading: "Fresh pieces for every day",
    description: "Fine chains, soft pearls and easy hoops, newly in and made to be worn often.",
    cta: "Shop new arrivals",
    href: "/collections/new-arrivals",
    image: { ...art("new-arrivals"), alt: "Sample artwork: layered necklaces in a stone arch, with pearl studs and a hoop on plinths" },
  },
  {
    id: "festive-edit",
    sampleLabel: "Sample campaign",
    eyebrow: "Festive edit",
    heading: "Made for evenings that glow",
    description: "Chandbalis and jhumkas with a little ceremony, for the celebrations ahead.",
    cta: "Explore festive earrings",
    href: "/categories/jewellery/jhumkas-chandbalis",
    image: { ...art("festive-edit"), alt: "Sample artwork: chandbali earrings on a stand and jhumkas on a plinth, with warm festive light" },
  },
  {
    id: "everyday-edit",
    sampleLabel: "Sample campaign",
    eyebrow: "The everyday edit",
    heading: "Quiet pieces, worn on repeat",
    description: "Minimal hoops, studs and clips that go with everything you own.",
    cta: "Explore the edit",
    href: "/collections/minimal-edit",
    image: { ...art("everyday-edit"), alt: "Sample artwork: gold-tone hoops in an arch, a ring and a claw clip on stone plinths" },
  },
];
