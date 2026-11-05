"use client";

import { useActionState } from "react";
import { buyForLoadTest } from "./actions";

export default function CheckoutLoadPage() {
  const [state, action, pending] = useActionState(buyForLoadTest, { message: "" });
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <h1 className="font-serif text-3xl text-[#46372F]">Checkout load test (sample only)</h1>
      <button disabled={pending} className="rounded bg-[#46372F] p-2 text-[#F8F5F0]">
        Run load purchase
      </button>
      <p data-testid="buy-result">{state.message}</p>
    </form>
  );
}
