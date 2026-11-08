import { priceDisplay } from "@/lib/pricing";
import { formatPrice } from "@/lib/sample-catalogue";

// The struck-through MRP and discount badge that sit beside a selling price. Renders nothing unless lib/pricing.ts
// finds a genuine discount of at least 1%, so the percentage is never typed in or hard-coded anywhere.
// The selling price itself stays in the caller's own element, so the MRP is never read as the price.
// Product cards show the badge on the image instead (DiscountBadge), so they pass badge={false}.
export function PriceComparison({ pricePaise, mrpPaise, className = "", badge = true }: { pricePaise: number; mrpPaise?: number; className?: string; badge?: boolean }) {
  const shown = priceDisplay(pricePaise, mrpPaise);
  if (!shown.discounted) return null;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <s className="text-ink-soft decoration-ink-soft/70"><span className="sr-only">MRP </span>{formatPrice(shown.mrpPaise)}</s>
      {badge && (
        <span className="self-center border border-gold-deep/40 px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide text-gold-deep">
          {shown.discountPercent}% off
        </span>
      )}
      {!badge && <span className="sr-only">, {shown.discountPercent}% off</span>}
    </span>
  );
}

/** The discount pill for the top-left of a product image. Nothing when there's no genuine discount. */
export function DiscountBadge({ pricePaise, mrpPaise, className = "" }: { pricePaise: number; mrpPaise?: number; className?: string }) {
  const shown = priceDisplay(pricePaise, mrpPaise);
  if (!shown.discounted) return null;
  return (
    <span aria-hidden="true" className={`rounded-full bg-espresso px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ivory ${className}`}>
      &minus;{shown.discountPercent}%
    </span>
  );
}
