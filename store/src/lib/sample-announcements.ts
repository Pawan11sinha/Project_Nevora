// SAMPLE announcements for the top announcement ticker prototype. They aren't real offers or promotions, and the bar
// always shows a "Sample" label next to them. A future announcement manager would replace this file with
// admin-published messages: order, active status, start and expiry dates, audience and preview.

/** Ticker speed, in pixels per second. Slow enough to read comfortably. */
export const TICKER_SPEED_PX_PER_SECOND = 40;

export type Announcement = {
  id: string;
  text: string;
  /** Optional: an existing NÉVORA route, checked by tests/sample-announcements.test.mjs. */
  link?: { href: string; label: string };
};

export const SAMPLE_ANNOUNCEMENTS: Announcement[] = [
  { id: "prototype", text: "Prototype only: nothing is for sale yet" },
  { id: "new-arrivals", text: "New arrivals are in", link: { href: "/collections/new-arrivals", label: "Explore" } },
  { id: "festive", text: "Festive earrings for the season", link: { href: "/categories/jewellery/jhumkas-chandbalis", label: "Discover" } },
  { id: "everyday", text: "The everyday edit, easy and minimal", link: { href: "/collections/minimal-edit", label: "Explore" } },
  { id: "aesthetic", text: "Shop by aesthetic: Korean, Coquette and Minimal", link: { href: "/collections/korean-edit", label: "Find your look" } },
];
