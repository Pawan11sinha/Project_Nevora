"use client";

import Link from "next/link";
import { BagIcon } from "@/components/layout/icons";
import { useBagCount } from "./bag-store";

export function BagLink({ className = "" }: { className?: string }) {
  const count = useBagCount();
  const label = count ? `Bag, ${count} ${count === 1 ? "item" : "items"}` : "Bag";
  return (
    <Link prefetch={false} href="/bag" aria-label={label} className={`relative ${className}`}>
      <BagIcon />
      {count ? (
        <span aria-hidden="true" className="absolute right-0 top-1 min-w-[1.15rem] rounded-full bg-espresso px-1 text-center text-[10px] font-semibold leading-[1.15rem] text-ivory">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
