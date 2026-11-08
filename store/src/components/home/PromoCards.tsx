import Link from "next/link";
import { ProductImage } from "@/components/catalogue/ProductImage";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FEATURES, type Feature, formatEndsAt, isAvailable, safeHref } from "@/lib/features";
import { type PromoCard, isCardVisible } from "@/lib/sample-promo-cards";

const STATE_LABEL = { draft: "Draft", planned: "Planned", active: "Active", disabled: "Disabled" } as const;

function CardBody({ card }: { card: PromoCard }) {
  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        <div className="transition-transform duration-700 ease-gentle group-hover:scale-[1.04] motion-reduce:transition-none">
          <ProductImage art={card.image.art} alt={card.image.alt} sizes="(min-width: 1024px) 22vw, 45vw" />
        </div>
        {card.label && (
          <span className="absolute left-3 top-3 rounded-full bg-ivory/95 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-espresso">{card.label}</span>
        )}
      </div>
      <h3 className="mt-4 font-serif text-xl font-medium leading-tight group-hover:underline group-hover:decoration-gold group-hover:underline-offset-4">{card.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{card.description}</p>
      {card.endsAt && <p className="mt-2 text-xs font-semibold text-ink-soft">{formatEndsAt(card.endsAt)}</p>}
    </>
  );
}

/**
 * Promotional collection cards. On the storefront (`preview` false) only cards customers may see are rendered, each
 * linking through safeHref; with none, the section renders nothing at all. The preview shows every card with its
 * state, and only live cards are links, so a planned card can never be opened as if it were finished.
 */
export function PromoCards({ cards, preview = false, now = new Date() }: { cards: PromoCard[]; preview?: boolean; now?: Date }) {
  const shown = [...cards].filter((c) => preview || isCardVisible(c, now)).sort((a, b) => a.order - b.order);
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="promo-title" className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
      <SectionHeading id="promo-title" eyebrow="Curated for you" title="Ways to shop" />
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-6">
        {shown.map((card) => {
          const live = isCardVisible(card, now);
          const destination: Feature = FEATURES[card.destination];
          return (
            <li key={card.id} data-card={card.id} data-state={live ? "visible" : "hidden"}>
              {live ? (
                <Link prefetch={false} href={safeHref(destination.href ?? "/")} className="group block">
                  <CardBody card={card} />
                </Link>
              ) : (
                <div className="group">
                  <CardBody card={card} />
                </div>
              )}
              {preview && (
                <dl className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-ink-soft">
                  <div><dt className="inline font-semibold text-espresso">Card: </dt><dd className="inline">{STATE_LABEL[card.status]}</dd></div>
                  <div><dt className="inline font-semibold text-espresso">Destination: </dt><dd className="inline">{destination.label}, {isAvailable(card.destination) ? "live" : STATE_LABEL[destination.state].toLowerCase()}</dd></div>
                  <div><dt className="inline font-semibold text-espresso">Customers: </dt><dd className="inline">{live ? "see this card" : "don't see this card"}</dd></div>
                  {destination.note && <div><dt className="sr-only">Note: </dt><dd>{destination.note}</dd></div>}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
