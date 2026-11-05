"use client";

import { useState } from "react";

// Proves client components hydrate. It isn't a cart.
export function AddButton() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setCount((c) => c + 1)}
      data-testid="hydration-button"
      className="mt-2 w-full rounded bg-[#46372F] px-2 py-1 text-sm text-[#F8F5F0]"
    >
      Clicked {count}
    </button>
  );
}
