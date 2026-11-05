"use client";

import { useActionState } from "react";
import { buy } from "./actions";

export default function CheckoutTestPage() {
  const [state, action, pending] = useActionState(buy, { message: "" });
  return (
    <form action={action} data-testid="checkout-form" className="flex max-w-sm flex-col gap-3">
      <h1 className="font-serif text-3xl text-[#46372F]">Checkout test (sample only)</h1>
      <button disabled={pending} className="rounded bg-[#46372F] p-2 text-[#F8F5F0]">
        Buy sample product
      </button>
      <p data-testid="buy-result">{state.message}</p>
    </form>
  );
}
