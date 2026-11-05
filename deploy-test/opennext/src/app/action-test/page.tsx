"use client";

import { useActionState } from "react";
import { submitTest } from "./actions";

// Test 5: a server action with Zod validation.
export default function ActionTestPage() {
  const [state, action, pending] = useActionState(submitTest, { message: "" });
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <h1 className="font-serif text-3xl text-[#46372F]">Server action test</h1>
      <input name="name" placeholder="Name" className="rounded border p-2" />
      <input name="phone" placeholder="10-digit mobile" className="rounded border p-2" />
      <button disabled={pending} className="rounded bg-[#46372F] p-2 text-[#F8F5F0]">
        Submit
      </button>
      <p data-testid="action-result">{state.message}</p>
    </form>
  );
}
