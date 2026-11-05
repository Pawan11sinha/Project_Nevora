"use client";

import { useActionState } from "react";
import { signIn } from "@/app/login-actions";

export function LoginForm({ title, next }: { title: string; next: string }) {
  const [state, action, pending] = useActionState(signIn, { message: "" });
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <h1 className="font-serif text-3xl text-[#46372F]">{title}</h1>
      <input type="hidden" name="next" value={next} />
      <input name="email" type="email" placeholder="Email" className="rounded border p-2" />
      <input name="password" type="password" placeholder="Password" className="rounded border p-2" />
      <button disabled={pending} className="rounded bg-[#46372F] p-2 text-[#F8F5F0]">
        Log in
      </button>
      <p data-testid="login-result">{state.message}</p>
    </form>
  );
}
