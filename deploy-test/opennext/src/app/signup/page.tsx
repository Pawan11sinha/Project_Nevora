"use client";

import { useActionState } from "react";
import { signUp } from "./actions";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, { message: "" });
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <h1 className="font-serif text-3xl text-[#46372F]">Create account test</h1>
      <input name="email" type="email" placeholder="Email" className="rounded border p-2" />
      <input name="password" type="password" placeholder="Password" className="rounded border p-2" />
      <button disabled={pending} className="rounded bg-[#46372F] p-2 text-[#F8F5F0]">Sign up</button>
      <p data-testid="signup-result">{state.message}</p>
    </form>
  );
}
