import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = { title: "Checkout (sample)" };

// The bag and the details stay in this browser. Placing an order isn't available until order saving is built.
export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-16 pt-5 lg:px-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/bag", label: "Bag" }, { label: "Checkout" }]} />
      <h1 className="mt-5 font-serif text-title font-medium leading-[1.05]">Checkout</h1>
      <CheckoutForm />
    </main>
  );
}
