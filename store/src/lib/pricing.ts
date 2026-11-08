// Price and discount display rules, shared by product cards and product pages. No browser or framework code, so it
// can be tested directly. Money is integer paise throughout.
//
// The discount is worked out from MRP and selling price, never typed in: ((MRP − price) ÷ MRP) × 100, rounded down so
// it's never overstated. It's shown only when MRP is genuinely higher and the result is at least 1%. A selling price
// above MRP is invalid, and so is a missing, zero, negative or fractional amount. The real store enforces the same
// rule in the database (product_variants: mrp_paise ≥ price_paise) and the admin form (M3).
// Regular price discounts are separate from promotional offers such as Buy 2 Get 1, which are M11 campaigns.

export const MIN_DISCOUNT_PERCENT = 1;

export class InvalidPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPricingError";
  }
}

const isPaise = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/** Whole-percent discount from MRP to selling price, rounded down. 0 when there's no MRP. Throws on invalid pricing. */
export function discountPercent(pricePaise: number, mrpPaise?: number | null): number {
  if (!isPaise(pricePaise)) throw new InvalidPricingError(`Selling price must be a positive whole number of paise, not ${pricePaise}.`);
  if (mrpPaise === undefined || mrpPaise === null) return 0;
  if (!isPaise(mrpPaise)) throw new InvalidPricingError(`MRP must be a positive whole number of paise, not ${mrpPaise}.`);
  if (pricePaise > mrpPaise) throw new InvalidPricingError(`Selling price (${pricePaise} paise) can't be more than MRP (${mrpPaise} paise).`);
  // Integer arithmetic, so there are no floating-point surprises at the boundaries.
  return Math.floor(((mrpPaise - pricePaise) * 100) / mrpPaise);
}

export type PriceDisplay =
  | { pricePaise: number; discounted: true; mrpPaise: number; discountPercent: number }
  | { pricePaise: number; discounted: false };

/** What to show: the selling price, plus MRP and the discount only when there's a genuine discount of at least 1%. */
export function priceDisplay(pricePaise: number, mrpPaise?: number | null): PriceDisplay {
  const percent = discountPercent(pricePaise, mrpPaise);
  return percent >= MIN_DISCOUNT_PERCENT && mrpPaise
    ? { pricePaise, discounted: true, mrpPaise, discountPercent: percent }
    : { pricePaise, discounted: false };
}
