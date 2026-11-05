import { getSupabase } from "@/lib/supabase";

// A public page that reads the database on each request. The view has no cost column.
export const dynamic = "force-dynamic";

export default async function ProductsLivePage() {
  const supabase = await getSupabase();
  const { data: products } = supabase
    ? await supabase.from("deploy_test_products_public").select("id, name, price_paise, stock")
    : { data: null };
  return (
    <ul data-testid="live-products">
      {products?.map((p) => (
        <li key={p.id}>
          {p.name}: {p.price_paise} paise, {p.stock} in stock
        </li>
      ))}
    </ul>
  );
}
