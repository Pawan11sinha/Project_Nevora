import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

// Test 10: the page checks the role itself and doesn't rely only on proxy.ts.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await getSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/admin/login");
  const { data: isAdmin } = await supabase.rpc("deploy_test_is_admin");
  if (!isAdmin) return <h1 data-testid="admin-denied">Not an admin</h1>;

  const [{ data: product }, { data: orders }] = await Promise.all([
    supabase.from("deploy_test_products_public").select("name, price_paise, stock").eq("id", 1).maybeSingle(),
    supabase.from("deploy_test_orders").select("id, unit_price_paise").order("id"),
  ]);

  return (
    <div>
      <h1 data-testid="admin-ok" className="font-serif text-3xl text-[#46372F]">Admin area test</h1>
      <p data-testid="admin-product">{product?.name}: {product?.price_paise} paise, {product?.stock} in stock</p>
      <p data-testid="admin-order-count">{orders?.length ?? 0} orders</p>
    </div>
  );
}
