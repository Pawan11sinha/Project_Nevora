"use client";

import { useFavourites, toggleFavourite } from "./favourites-store";
import { isAccountIdentityTransitionPending } from "@/lib/account-identity-client";

// A heart that saves or removes a product from this browser's favourites. Outline when not saved, filled espresso with a
// thin decorative gold ring when saved, with aria-pressed so screen readers hear the state. It's a real button (Enter and Space work) and sits
// beside product links, never inside them, so pressing it never opens the product.

export const HeartIcon = ({ filled, size = 20 }: { filled: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
    <path d="M12 20.3s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.5-7.5 10.1-7.5 10.1Z" />
  </svg>
);

export function FavouriteButton({ slug, name, className = "", size = "card" }: { slug: string; name: string; className?: string; size?: "card" | "page" }) {
  const favourites = useFavourites();
  const saved = favourites?.includes(slug) ?? false;
  const switchingAccount = isAccountIdentityTransitionPending();
  const dimensions = size === "card" ? "size-11" : "size-12"; // at least 44px, the card tap-target minimum
  return (
    <button
      type="button"
      disabled={switchingAccount}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavourite(slug); }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      title={saved ? "Remove from favourites" : "Save to favourites"}
      className={`inline-flex ${dimensions} items-center justify-center rounded-full bg-ivory/95 shadow-[0_2px_10px_rgba(52,37,31,0.14)] backdrop-blur transition-[transform,color] duration-200 ease-gentle hover:scale-105 active:scale-95 ${saved ? "text-espresso ring-1 ring-gold" : "text-espresso hover:text-ink-soft"} ${className}`}
    >
      <HeartIcon filled={saved} size={size === "card" ? 20 : 22} />
    </button>
  );
}
