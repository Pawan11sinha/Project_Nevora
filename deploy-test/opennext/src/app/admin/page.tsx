import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

// Test 10: the page checks the role itself and doesn't rely only on proxy.ts.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await getSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect("/admin/login");
  const { data: isAdmin } = await supabase!.rpc("deploy_test_is_admin");
  if (!isAdmin) return <h1 data-testid="admin-denied">Not an admin</h1>;
  return <h1 data-testid="admin-ok">Admin area test</h1>;
}
