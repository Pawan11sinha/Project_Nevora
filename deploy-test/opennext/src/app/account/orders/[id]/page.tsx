import { notFound, redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

// A customer's own order. RLS decides what's visible, so someone else's order is simply not found.
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/login");
  if (!/^\d+$/.test(id)) notFound();

  const { data: order } = await supabase
    .from("deploy_test_orders")
    .select("id, product_id, unit_price_paise, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  return (
    <article data-testid="order">
      <h1 className="font-serif text-3xl text-[#46372F]">Order {order.id}</h1>
      <p data-testid="order-price">{order.unit_price_paise} paise</p>
    </article>
  );
}
