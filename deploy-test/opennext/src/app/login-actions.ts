"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export async function signIn(_prev: { message: string }, form: FormData) {
  const supabase = await getSupabase();
  if (!supabase) return { message: "Supabase isn't configured" };
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("password")),
  });
  if (error) return { message: "Login failed" };
  redirect(String(form.get("next")) === "/admin" ? "/admin" : "/account");
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase?.auth.signOut();
  redirect("/");
}
