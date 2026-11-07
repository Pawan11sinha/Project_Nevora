"use client";

import Link from "next/link";
import { ProductImage } from "@/components/catalogue/ProductImage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { MAX_QUANTITY, itemCount, resolveLines, subtotalPaise, type ResolvedLine } from "@/lib/cart";
import { findProduct, formatPrice } from "@/lib/sample-catalogue";
import { changeQuantity, removeFromBag, useBagLines } from "./bag-store";

const problemText = {
  missing: "This piece is no longer available.",
  "sold-out": "This piece is sold out.",
  finish: "This finish is no longer available.",
};

const stepClass = "inline-flex size-11 items-center justify-center text-lg disabled:cursor-not-allowed disabled:text-control";

function Line({ line }: { line: ResolvedLine }) {
  const name = line.product?.name ?? "Unavailable piece";
  const href = line.product ? `/products/${line.product.slug}` : undefined;
  return (
    <li className="flex gap-4 border-b border-line py-5 sm:gap-6">
      <div className={`w-24 shrink-0 sm:w-28 ${line.problem ? "opacity-60" : ""}`}>
        {line.product ? (
          <Link prefetch={false} href={href!} tabIndex={-1} aria-hidden="true">
            <ProductImage art={line.product.art} alt="" sizes="112px" />
          </Link>
        ) : (
          <div className="aspect-[4/5] w-full bg-cream" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-serif text-[1.2rem] font-medium leading-snug">
              {href ? <Link prefetch={false} href={href} className="hover:underline hover:decoration-gold hover:underline-offset-4">{name}</Link> : name}
            </h2>
            <p className="mt-0.5 text-sm text-ink-soft">Finish: {line.finish}</p>
            {line.product && <p className="mt-0.5 text-sm text-ink-soft">{formatPrice(line.unitPaise)} each</p>}
          </div>
          {!line.problem && <p className="shrink-0 text-sm font-semibold">{formatPrice(line.linePaise)}</p>}
        </div>
        {line.problem && <p className="mt-2 text-sm font-medium">{problemText[line.problem]} It isn&rsquo;t included in your subtotal.</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3">
          {line.problem ? <span /> : (
            <div role="group" aria-label={`Quantity for ${name}, ${line.finish}`} className="inline-flex items-center border border-control">
              <button type="button" aria-label="Decrease quantity" disabled={line.quantity <= 1} onClick={() => changeQuantity(line.key, line.quantity - 1)} className={stepClass}>&minus;</button>
              <span aria-live="polite" className="min-w-8 text-center text-sm font-semibold">{line.quantity}</span>
              <button type="button" aria-label="Increase quantity" disabled={line.quantity >= MAX_QUANTITY} onClick={() => changeQuantity(line.key, line.quantity + 1)} className={stepClass}>+</button>
            </div>
          )}
          <button type="button" aria-label={`Remove ${name}, ${line.finish}`} onClick={() => removeFromBag(line.key)} className="min-h-11 text-sm font-semibold underline decoration-gold underline-offset-4 hover:decoration-espresso">Remove</button>
        </div>
      </div>
    </li>
  );
}

export function BagContents() {
  const lines = useBagLines();

  if (lines === null) {
    return (
      <>
        <p className="mt-6 text-ink-soft">Loading your bag&hellip;</p>
        <noscript><p className="mt-2 text-sm">Your bag needs JavaScript turned on in your browser.</p></noscript>
      </>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mt-6">
        <p className="text-lg">Your bag is empty.</p>
        <p className="mt-1 text-ink-soft">Browse the collection and add a piece you love.</p>
        <div className="mt-6"><ButtonLink href="/">Continue shopping</ButtonLink></div>
      </div>
    );
  }

  const resolved = resolveLines(lines, findProduct);
  const available = resolved.filter((line) => !line.problem);
  const count = itemCount(available);

  return (
    <div className="mt-6 grid gap-10 md:grid-cols-[1fr_18rem] lg:grid-cols-[1fr_20rem] lg:gap-14">
      <ul className="border-t border-line">
        {resolved.map((line) => <Line key={line.key} line={line} />)}
      </ul>
      <aside aria-labelledby="summary-title" className="md:sticky md:top-28 md:self-start">
        <h2 id="summary-title" className="font-serif text-heading font-medium">Summary</h2>
        <dl className="mt-4 flex items-baseline justify-between border-y border-line py-4">
          <dt className="text-sm">Subtotal ({count} {count === 1 ? "item" : "items"})</dt>
          <dd className="text-lg font-semibold">{formatPrice(subtotalPaise(resolved))}</dd>
        </dl>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">Sample prices. Shipping and the final total are worked out at checkout.</p>
        <div className="mt-6 grid gap-3">
          {count > 0 ? (
            <ButtonLink href="/checkout">Proceed to checkout</ButtonLink>
          ) : (
            <Button disabled className="min-h-12 cursor-not-allowed !bg-ink-soft !text-ivory !opacity-100">Nothing available to check out</Button>
          )}
          <ButtonLink href="/" variant="secondary">Continue shopping</ButtonLink>
        </div>
      </aside>
    </div>
  );
}
