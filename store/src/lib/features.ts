// Feature availability: the one place that decides whether a storefront feature, and its URL, is open to customers.
// Components never write their own redirect or visibility rules; they ask here.
//
//   draft     being written; never shown anywhere but the design preview
//   planned   agreed but not built; shown only in the admin/design preview, never to customers
//   active    live: links open the real destination, but only while it has real content (see `ready`)
//   disabled  switched off: hidden everywhere
//
// A customer-facing URL that belongs to a feature which isn't available redirects to the homepage, so a stale link or
// bookmark never opens an empty or unfinished page. States change by editing this file until the admin foundation
// (M3, M4b) moves them to the database; start dates never change a state on their own (manual publishing rule).
import { COLLECTIONS, productsInCollection } from "./sample-catalogue.ts";

export type FeatureState = "draft" | "planned" | "active" | "disabled";

export type Feature = {
  id: string;
  label: string;
  /** The customer-facing route, if the feature has one. */
  href?: string;
  state: FeatureState;
  /** Extra condition for an active feature, such as having real products. Defaults to ready. */
  ready?: () => boolean;
  /** Why it isn't active yet, for the preview and the roadmap. */
  note?: string;
};

const hasProducts = (slug: string) => () => {
  const c = COLLECTIONS.find((x) => x.slug === slug);
  return Boolean(c) && productsInCollection(c!).length > 0;
};

export const FEATURES = {
  faq: { id: "faq", label: "FAQs", href: "/info/faq", state: "active" },
  collectionsIndex: { id: "collectionsIndex", label: "All collections", href: "/collections", state: "active" },
  festiveEdit: { id: "festiveEdit", label: "Festive Edit", href: "/collections/festive-edit", state: "active", ready: hasProducts("festive-edit"), note: "Shown once real festive products exist." },
  giftBox: { id: "giftBox", label: "Gift Box", href: "/collections/gift-box", state: "active", ready: hasProducts("gift-box"), note: "Shown once real gift-ready products exist." },
  jewelleryBox: { id: "jewelleryBox", label: "Create Your Own Jewellery Box", href: "/collections/jewellery-box", state: "planned", note: "Needs bundle building and pricing, which don't exist yet." },
  mixAndMatch: { id: "mixAndMatch", label: "Mix & Match", href: "/collections/mix-and-match", state: "planned", note: "Needs multi-item offer rules (M11, after launch)." },
  giftSets: { id: "giftSets", label: "Jewellery Gift Sets", href: "/collections/gift-sets", state: "planned", note: "Needs real gift-set products and photos." },
  giftCombos: { id: "giftCombos", label: "Gift Combos", href: "/collections/gift-combos", state: "planned", note: "Needs combo pricing (M11, after launch)." },
  orderHelp: { id: "orderHelp", label: "Order Help", state: "planned", note: "Needs the order page (M5)." },
  offers: { id: "offers", label: "Offers and coupons", state: "disabled", note: "M11, after launch." },
  newsletter: { id: "newsletter", label: "Newsletter", state: "disabled", note: "Needs the domain, Resend, consent handling and the CA's DPDP answer." },
} as const satisfies Record<string, Feature>;

export type FeatureId = keyof typeof FEATURES;

const all = (): Feature[] => Object.values(FEATURES);

/** True only when a customer may see and use the feature. */
export function isAvailable(id: FeatureId): boolean {
  const f: Feature = FEATURES[id];
  return f.state === "active" && (f.ready?.() ?? true);
}

/** Feature URLs customers must not reach yet. Each redirects to the homepage. */
export function unavailablePaths(): string[] {
  return all().filter((f) => f.href && !isAvailable(f.id as FeatureId)).map((f) => f.href!);
}

/**
 * The URL a customer link should actually use. Paths that belong to an unavailable feature become "/", so no
 * component can link to an unfinished page by accident. Paths that aren't features pass through unchanged.
 */
export function safeHref(href: string): string {
  return unavailablePaths().includes(href) ? "/" : href;
}

/** A link for customer navigation, or null when its feature isn't available (so the link is left out). */
export function featureLink(id: FeatureId): { href: string; label: string } | null {
  const f: Feature = FEATURES[id];
  return f.href && isAvailable(id) ? { href: f.href, label: f.label } : null;
}

/** The last segment of each unavailable /collections/ path, for the collection route's redirects. */
export function unavailableCollectionSlugs(): string[] {
  return unavailablePaths().filter((p) => p.startsWith("/collections/")).map((p) => p.slice("/collections/".length));
}

/** Static, truthful end-date text, such as "Ends 14 Feb 2027, 11:59 pm IST". Never a ticking countdown. */
export function formatEndsAt(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(d).toLowerCase();
  return `Ends ${date}, ${time} IST`;
}
