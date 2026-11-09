"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileFormState } from "@/app/account/actions";
import { FormAlert, SubmitButton, TextField } from "@/components/auth/fields";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action] = useActionState<ProfileFormState, FormData>(updateProfileAction, {});
  return (
    <form action={action} noValidate className="grid gap-5">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state.saved && <FormAlert tone="info">Your details are saved.</FormAlert>}
      <TextField label="Full name" name="fullName" autoComplete="name" required maxLength={100} defaultValue={state.values?.fullName ?? fullName} error={state.fields?.fullName} />
      <TextField
        label="Mobile number (optional)"
        name="phone"
        type="tel"
        autoComplete="tel-national"
        inputMode="numeric"
        // Room for "+91 98765 43210" (15 characters); the server strips the spaces and +91.
        maxLength={20}
        defaultValue={state.values?.phone ?? phone}
        error={state.fields?.phone}
        hint="A 10-digit Indian mobile number. We'll use it for delivery updates on your orders."
      />
      <div className="sm:max-w-56"><SubmitButton pendingText="Saving…">Save details</SubmitButton></div>
    </form>
  );
}
