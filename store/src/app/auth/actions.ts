"use server";

import { redirect } from "next/navigation";
import { authErrorMessage } from "@/lib/auth/messages";
import { safeNext } from "@/lib/auth/redirects";
import { fieldErrors, signInSchema, signUpSchema, type FieldErrors } from "@/lib/auth/validation";
import { isAccountId } from "@/lib/account-storage";
import { clearAccountIdentityCookie, setAccountIdentityCookie } from "@/lib/supabase/account-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// V1 customer sign-up, sign-in and sign-out. Every input is validated here on the server, whatever the browser did.
// Nothing here can grant the admin role.

export type AuthFormState = {
  error?: string;
  fields?: FieldErrors;
  /** Values to put back into the form after an error. Passwords are never sent back. */
  values?: Record<string, string>;
}
export type SignOutState = { error?: string };

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const UNAVAILABLE: AuthFormState = { error: "Sign-in isn't available at the moment. Please try again later." };

function redirectAfterIdentityChange(destination: string, transitionId: string): never {
  const url = new URL(destination, "https://nevora.invalid");
  if (isAccountId(transitionId)) url.searchParams.set("identity_transition", transitionId);
  redirect(`${url.pathname}${url.search}${url.hash}`);
}

export async function signUpAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = { fullName: text(form, "fullName"), email: text(form, "email"), password: text(form, "password"), confirmPassword: text(form, "confirmPassword") };
  const values = { fullName: input.fullName, email: input.email };
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...UNAVAILABLE, values };
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // Only the name goes into signup metadata. The database trigger copies it into the profile and always sets the
    // role to customer, whatever the metadata says.
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) return { error: authErrorMessage(error), values };
  // With email confirmation disabled, a successful signup must return a session. Supabase may intentionally return
  // no session for an existing address; never present that as a successful sign-in.
  if (!data.session) return { error: authErrorMessage(null), values };
  if (!data.user?.id) return { error: authErrorMessage(null), values };
  await setAccountIdentityCookie(data.user.id);
  redirectAfterIdentityChange("/account", text(form, "identityTransitionId"));
}

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { email: text(form, "email") };
  const parsed = signInSchema.safeParse({ email: text(form, "email"), password: text(form, "password") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...UNAVAILABLE, values };
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };
  if (!data.user?.id) return { error: authErrorMessage(null), values };
  await setAccountIdentityCookie(data.user.id);
  redirectAfterIdentityChange(safeNext(text(form, "next")), text(form, "identityTransitionId"));
}

export async function signOutAction(_previousState: SignOutState, form: FormData): Promise<SignOutState> {
  const transitionId = text(form, "identityTransitionId");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Sign-in isn't available at the moment. Please try again later." };
  // Signs out this device only, and clears its session cookies.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return { error: "We couldn't confirm sign-out. Your session may still be active." };
  await clearAccountIdentityCookie();
  redirectAfterIdentityChange("/auth/login?status=signed-out", transitionId);
}
