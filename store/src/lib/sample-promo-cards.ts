// SAMPLE promotional collection cards, for the development design preview only (/design/promotions). None of these
// features exists yet. Three independent guards keep them away from customers: every card is marked `sample` (which
// isCardVisible always refuses), every card is "planned", and every destination is a planned feature. No storefront
// page renders PromoCards; tests/features.test.mjs checks all of this. Their dates are illustrative only.
// When the admin foundation exists (M3, M4b), cards move to the database and are managed in admin with the banner manager's rules: published manually, start
// dates informational only, end dates hide a card automatically, and no countdowns or invented offers.
import type { Art } from "./sample-catalogue";
import { type FeatureId, type FeatureState, isAvailable } from "./features.ts";

export type PromoCard = {
  id: string;
  /** Sample content. A sample card is never shown to customers, whatever its status or dates. */
  sample?: boolean;
  title: string;
  description: string;
  /** Optional short label on the image. Must be true; never a discount or urgency claim without a real offer. */
  label?: string;
  image: { art: Art; alt: string };
  /** The card's own publication state. */
  status: FeatureState;
  /** Where the card leads. A card is shown only while this feature is available too. */
  destination: FeatureId;
  order: number;
  /** Informational only: a start date never publishes a card. */
  startsAt?: string;
  /** A card disappears after this time, and shows it as a static date (never a countdown). */
  endsAt?: string;
};

export const SAMPLE_PROMO_CARDS: PromoCard[] = [
  {
    id: "jewellery-box",
    title: "Create Your Own Jewellery Box",
    description: "Choose the pieces you love and gather them in one keepsake box.",
    image: { art: "layered", alt: "Sample artwork: a layered pearl chain" },
    sample: true,
    status: "planned",
    destination: "jewelleryBox",
    order: 1,
  },
  {
    id: "mix-and-match",
    title: "Mix & Match",
    description: "Pair earrings, clips and chains into a look that's yours.",
    image: { art: "clip", alt: "Sample artwork: a pearl bar hair clip" },
    sample: true,
    status: "planned",
    destination: "mixAndMatch",
    order: 2,
  },
  {
    id: "gift-sets",
    title: "Jewellery Gift Sets",
    description: "Ready-to-give sets, wrapped for someone special.",
    label: "Gifting",
    image: { art: "chandbali", alt: "Sample artwork: pearl chandbali earrings" },
    sample: true,
    status: "planned",
    destination: "giftSets",
    order: 3,
  },
  {
    id: "gift-combos",
    title: "Gift Combos",
    description: "Hair accessories and jewellery, put together for gifting.",
    image: { art: "bow", alt: "Sample artwork: a ribbon hair bow" },
    sample: true,
    status: "planned",
    destination: "giftCombos",
    order: 4,
    startsAt: "2027-02-01T00:00:00+05:30",
    endsAt: "2027-02-14T23:59:00+05:30",
  },
];

/** Whether a customer may see this card at `now`: published, its destination live, and not past its end date. */
export function isCardVisible(card: PromoCard, now: Date = new Date()): boolean {
  if (card.sample) return false;
  if (card.status !== "active" || !isAvailable(card.destination)) return false;
  return !card.endsAt || new Date(card.endsAt) > now;
}

/** The cards customers see, in display order. Empty today: every sample card is planned. */
export const visiblePromoCards = (cards: PromoCard[] = SAMPLE_PROMO_CARDS, now: Date = new Date()) =>
  cards.filter((c) => isCardVisible(c, now)).sort((a, b) => a.order - b.order);
