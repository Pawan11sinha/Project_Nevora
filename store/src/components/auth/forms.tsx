"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { signInAction, signUpAction, type AuthFormState } from "@/app/auth/actions";
import { beginAccountIdentityChange, cancelAccountIdentityChange } from "@/lib/account-identity-client";
import { LINK_ERRORS, STATUS_MESSAGES } from "@/lib/auth/messages";
import { FormAlert, PasswordField, SubmitButton, TextField } from "./fields";

// The sign-in screens' forms. They post to server actions, which validate everything again and decide the outcome.
// Messages from redirects (?error=, ?status=) are read here in the browser, so the pages themselves stay pre-rendered.

const initial: AuthFormState = {};

function RedirectMessage() {
  const params = useSearchParams();
  const error = LINK_ERRORS[params.get("error") ?? ""];
  const statusKey = params.get("status") ?? "";
  const status = STATUS_MESSAGES[statusKey];
  if (error) return <div className="mb-6"><FormAlert tone="error">{error}</FormAlert></div>;
  if (status) return <div className="mb-6"><FormAlert tone={statusKey === "sign-out-warning" ? "error" : "info"}>{status}</FormAlert></div>;
  return null;
}

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const [state, action] = useActionState(signInAction, initial);
  const transitionId = useRef<string | null>(null);
  const transitionInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.error || state.fields) {
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
    <div>
      <RedirectMessage />
      <form action={action} onSubmit={beginTransition} noValidate className="grid gap-5">
        <input type="hidden" name="next" value={next} />
        <input ref={transitionInput} type="hidden" name="identityTransitionId" defaultValue="" />
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        <TextField label="Email address" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={320} defaultValue={state.values?.email} error={state.fields?.email} />
        <PasswordField label="Password" name="password" autoComplete="current-password" error={state.fields?.password} />
        <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
      </form>
    </div>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initial);
  const transitionId = useRef<string | null>(null);
  const transitionInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.error || state.fields) {
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
    <form action={action} onSubmit={beginTransition} noValidate className="grid gap-5">
      <input ref={transitionInput} type="hidden" name="identityTransitionId" defaultValue="" />
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <TextField label="Full name" name="fullName" autoComplete="name" required maxLength={100} defaultValue={state.values?.fullName} error={state.fields?.fullName} />
      <TextField label="Email address" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={320} defaultValue={state.values?.email} error={state.fields?.email} />
      <PasswordField label="Password" name="password" autoComplete="new-password" error={state.fields?.password} showChecklist />
      <PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" error={state.fields?.confirmPassword} />
      <SubmitButton pendingText="Creating your account…">Create account</SubmitButton>
    </form>
  );
}
