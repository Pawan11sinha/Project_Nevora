"use client";

import { signOutAction } from "@/app/auth/actions";
import { beginAccountIdentityChange, cancelAccountIdentityChange } from "@/lib/account-identity-client";
import { FormAlert } from "@/components/auth/fields";
import { useActionState, useEffect, useRef } from "react";

export function SignOutForm() {
  const [state, action] = useActionState(signOutAction, {});
  const transitionId = useRef<string | null>(null);
  const transitionInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.error) {
      cancelAccountIdentityChange(transitionId.current);
      transitionId.current = null;
      if (transitionInput.current) transitionInput.current.value = "";
    }
  }, [state]);
  const beginTransition = () => {
    const id = beginAccountIdentityChange();
    transitionId.current = id;
    if (transitionInput.current) transitionInput.current.value = id;
  };
  return (
    <form action={action} onSubmit={beginTransition} className="mt-12 border-t border-line pt-6">
      {state.error && <div className="mb-4"><FormAlert tone="error">{state.error}</FormAlert></div>}
      <input ref={transitionInput} type="hidden" name="identityTransitionId" defaultValue="" />
      <button type="submit" className="inline-flex min-h-11 items-center border border-espresso px-6 text-sm font-semibold tracking-wide text-espresso transition-colors duration-200 hover:bg-espresso hover:text-ivory">Sign out</button>
    </form>
  );
}
