"use server";

import { getSupabase } from "@/lib/supabase";

// Reads nothing from the form, so a customer can't send a price. The database sets it.
export async function buy() {
  const supabase = await getSupabase();
  if (!supabase) return { message: "Unavailable" };
  const { data, error } = await supabase.rpc("deploy_test_take_one");
  if (error) {
    console.error("checkout failed", error.code);
    return { message: "Purchase failed" };
  }
  return { message: data === true ? "Purchased" : "Sold out" };
}
