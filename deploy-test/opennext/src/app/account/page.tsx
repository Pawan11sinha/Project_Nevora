import { redirect } from "next/navigation";
import { signOut } from "@/app/login-actions";
import { getSupabase } from "@/lib/supabase";

// Test 9: a page that reads the session on the server.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await getSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect("/login");
  return (
    <form action={signOut} className="flex flex-col items-start gap-3">
      <h1 className="font-serif text-3xl text-[#46372F]">Logged in</h1>
      <p data-testid="session">Session works on the server.</p>
      <button className="rounded bg-[#46372F] p-2 text-[#F8F5F0]">Log out</button>
    </form>
  );
}
