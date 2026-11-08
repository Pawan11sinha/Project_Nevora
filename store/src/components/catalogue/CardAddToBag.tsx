"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { addToBag } from "@/components/cart/bag-store";
import { FinishPicker } from "@/components/product/FinishPicker";
import { ADD_RESULT_MESSAGES, addProblem } from "@/lib/cart";
import type { Product } from "@/lib/sample-catalogue";

// Add to Bag on a product card. It sits after the card's link, never inside it, so the card still opens the product.
// - One finish: a single tap adds it.
// - Several finishes: a small chooser opens and nothing is added until the customer picks a finish.
// It uses the same bag as the product page (addToBag), so the header count updates at once, a repeat of the same
// product and finish raises its quantity instead of adding a second line, and prices still come from the catalogue.

const buttonClass = "inline-flex min-h-11 w-full items-center justify-center rounded-full px-3 text-[0.78rem] font-semibold uppercase tracking-[0.12em] transition-[background-color,box-shadow] duration-200";
// Espresso with ivory text, like the product page's Add to bag, darkening slightly on hover (tests/tokens.test.mjs).
const primary = `${buttonClass} bg-espresso text-ivory shadow-[0_4px_14px_rgba(52,37,31,0.22)] hover:bg-espresso-deep`;
const quiet = `${buttonClass} border border-control text-ink-soft`;

export function CardAddToBag({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [finish, setFinish] = useState<string | null>(null);
  const [status, setStatus] = useState<{ added: boolean; text: string } | null>(null);
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const single = product.finishes.length === 1;

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setFinish(null);
    if (returnFocus) trigger.current?.focus();
  };

  // While the chooser is open: move focus into it, and close it on a click or tap outside.
  useEffect(() => {
    if (!open) return;
    wrapper.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    const outside = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) { setOpen(false); setFinish(null); }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const add = (chosen: string | null) => {
    if (addProblem(product, chosen)) return; // never add a missing, sold-out or unknown finish
    const result = addToBag(product.slug, chosen!);
    setStatus(result === "added" ? { added: true, text: `Added ${product.name}, ${chosen}.` } : { added: false, text: ADD_RESULT_MESSAGES[result] });
    if (!single) close(true);
  };

  if (product.soldOut) {
    return (
      <button type="button" disabled aria-label={`${product.name} is sold out`} className={`${quiet} cursor-not-allowed`}>
        Sold out
      </button>
    );
  }

  return (
    <div
      ref={wrapper}
      className="relative"
      onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); close(true); } }}
    >
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={`Choose a finish for ${product.name}`}
          className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-xl border border-line bg-ivory p-3 shadow-[0_8px_24px_rgba(52,37,31,0.14)]"
        >
          <FinishPicker finishes={product.finishes} value={finish} onChange={(next) => { setFinish(next); setStatus(null); }} />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button type="button" disabled={!finish} onClick={() => add(finish)} aria-label={finish ? `Add ${product.name}, ${finish}, to bag` : "Choose a finish first"} className={`${primary} min-w-0 flex-1 basis-28 whitespace-nowrap disabled:cursor-not-allowed disabled:bg-control disabled:shadow-none`}>
              Add to bag
            </button>
            <button type="button" onClick={() => close(true)} className="min-h-11 px-3 text-[0.8rem] font-semibold underline decoration-gold underline-offset-4 hover:decoration-espresso">
              Cancel
            </button>
          </div>
        </div>
      )}
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setStatus(null);
          if (single) add(product.finishes[0]);
          else if (open) close(false);
          else setOpen(true);
        }}
        aria-label={single ? `Add ${product.name} to bag` : `Choose a finish for ${product.name}`}
        aria-expanded={single ? undefined : open}
        aria-controls={single || !open ? undefined : panelId}
        className={primary}
      >
        {single ? "Add to bag" : "Choose finish"}
      </button>
      <div role="status" className="mt-1.5 min-h-5 text-xs leading-snug">
        {status && (
          <>
            {status.text}
            {status.added && <> <Link prefetch={false} href="/bag" className="font-semibold underline decoration-gold underline-offset-4 hover:decoration-espresso">View bag</Link></>}
          </>
        )}
      </div>
    </div>
  );
}
