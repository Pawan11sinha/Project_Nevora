"use server";

import { getSupabase } from "@/lib/supabase";

// Load test only: the same path as the real checkout, but the database undoes the purchase.
export async function buyForLoadTest() {
  const supabase = await getSupabase();
  if (!supabase) return { message: "Unavailable" };
  const { data, error } = await supabase.rpc("deploy_test_load_purchase");
  if (error) {
    console.error("load checkout failed", error.code);
    return { message: "Purchase failed" };
  }
  return { message: data === true ? "Purchased" : "Sold out" };
}
