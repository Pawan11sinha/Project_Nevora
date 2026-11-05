import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login-actions";
import { getSupabase } from "@/lib/supabase";

// Test 9: reads the session on the server, then the user's own orders through RLS.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await getSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/login");

  const { data: orders } = await supabase
    .from("deploy_test_orders")
    .select("id, unit_price_paise")
    .order("id");

  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="font-serif text-3xl text-[#46372F]">Logged in</h1>
      <p data-testid="session">Session works on the server.</p>
      <ul data-testid="orders">
        {orders?.map((o) => (
          <li key={o.id}>
            <Link href={`/account/orders/${o.id}`} prefetch={false}>
              Order {o.id}: {o.unit_price_paise} paise
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut}>
        <button className="rounded bg-[#46372F] p-2 text-[#F8F5F0]">Log out</button>
      </form>
    </div>
  );
}
