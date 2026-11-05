"use server";

import { getSupabase } from "@/lib/supabase";
import { signupSchema } from "@/lib/validation";

export async function signUp(_prev: { message: string }, form: FormData) {
  const details = signupSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!details.success) return { message: "Check your email and password" };

  const supabase = await getSupabase();
  if (!supabase) return { message: "Signup isn't available" };
  // No metadata is sent. The same message appears whether or not the address already has an account.
  const { error } = await supabase.auth.signUp(details.data);
  if (error) console.error("signup failed", error.code);
  return { message: "Check your email to confirm your account" };
}
