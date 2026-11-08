import { PromoCards } from "@/components/home/PromoCards";
import { visiblePromoCards, SAMPLE_PROMO_CARDS } from "@/lib/sample-promo-cards";

export const metadata = { title: "Promotional cards preview (sample)", robots: { index: false, follow: false } };

// DEVELOPMENT PREVIEW ONLY. Shows every sample promotional card with its state, for design review on local builds and
// the password-protected staging Worker. It is NOT an admin screen and NOT a substitute for one: it has no admin
// authentication of its own. Before public launch it must be removed, or moved behind the real admin login with AAL2
// (M3); this is a go-live check in docs/SECURITY_PLAN.md. The storefront shows only live cards (none today).
export default function PromotionsPreviewPage() {
  const customerCount = visiblePromoCards().length;
  return (
    <main>
      <div className="mx-auto max-w-7xl px-5 pt-10 lg:px-8">
        <p className="inline-block rounded-full border border-gold px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">Preview only · Sample</p>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed">Development preview, not an admin screen. It is removed or moved behind admin login before launch.</p>
        <h1 className="mt-4 font-serif text-title font-medium leading-[1.05]">Promotional cards</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
          Every card here is a labelled sample, and every one is planned: the jewellery box, mix-and-match, gift sets
          and combos don&rsquo;t exist yet. Customers see {customerCount === 0 ? "none of these cards" : `${customerCount} of these cards`}, and
          their addresses lead back to the homepage until the feature is live. Dates are shown as fixed text, never as a countdown.
        </p>
      </div>
      <PromoCards cards={SAMPLE_PROMO_CARDS} preview />
    </main>
  );
}
