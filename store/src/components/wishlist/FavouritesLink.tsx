"use client";

import Link from "next/link";
import { HeartIcon } from "./FavouriteButton";
import { useFavourites } from "./favourites-store";

// Header link to the Favourites page, with a count, mirroring the bag link.
export function FavouritesLink({ className = "" }: { className?: string }) {
  const count = useFavourites()?.length ?? 0;
  const label = count ? `Favourites, ${count} ${count === 1 ? "piece" : "pieces"}` : "Favourites";
  return (
    <Link prefetch={false} href="/favourites" aria-label={label} className={`relative ${className}`}>
      <HeartIcon filled={false} size={22} />
      {count ? (
        <span aria-hidden="true" className="absolute right-0 top-1 min-w-[1.15rem] rounded-full bg-espresso px-1 text-center text-[10px] font-semibold leading-[1.15rem] text-ivory">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
