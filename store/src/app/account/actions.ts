"use server";

import { revalidatePath } from "next/cache";
import { authErrorMessage } from "@/lib/auth/messages";
import { fieldErrors, profileSchema, type FieldErrors } from "@/lib/auth/validation";
import { getLiveCustomer } from "@/lib/supabase/session";

export type ProfileFormState = { error?: string; fields?: FieldErrors; saved?: boolean; values?: Record<string, string> };

// Updates the signed-in customer's name and mobile number. The session is checked here with getLiveCustomer() (Auth,
// then the database's live-session check, DEF-6); the database then allows the update only on the customer's own row,
// only from a live session, and only for these two columns (RLS and column grants).
export async function updateProfileAction(_prev: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const values = { fullName: String(form.get("fullName") ?? ""), phone: String(form.get("phone") ?? "") };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const check = await getLiveCustomer();
  if (check.status === "unavailable") return { error: "Your account isn't available at the moment. Please try again later.", values };
  if (check.status !== "live") return { error: "Your session has ended. Please sign in again.", values };
  const { supabase, user } = check.customer;

  // Asking for the updated row back confirms the update really happened: RLS refusing it would return no row, not an error.
  const { data, error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null }).eq("id", user.id).select("id");
  if (error || data?.length !== 1) return { error: authErrorMessage(null), values };
  revalidatePath("/account");
  return { saved: true, values: { fullName: parsed.data.fullName, phone: parsed.data.phone } };
}
