"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { loginDestination, loginSchema } from "@/lib/validation";

const LOGIN_FAILED = { message: "Login failed" };

export async function signIn(_prev: { message: string }, form: FormData) {
  const supabase = await getSupabase();
  if (!supabase) return { message: "Login isn't available" };

  const credentials = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!credentials.success) return LOGIN_FAILED;

  const { error } = await supabase.auth.signInWithPassword(credentials.data);
  if (error) return LOGIN_FAILED;
  redirect(loginDestination(form.get("next")));
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase?.auth.signOut();
  redirect("/");
}
