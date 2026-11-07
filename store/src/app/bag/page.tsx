import type { Metadata } from "next";
import { BagContents } from "@/components/cart/BagContents";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = { title: "Your bag (sample)" };

// The bag is read from this browser's storage, so the page itself is the same for everyone and can be static.
export default function BagPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-16 pt-5 lg:px-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Bag" }]} />
      <h1 className="mt-5 font-serif text-title font-medium leading-[1.05]">Your bag</h1>
      <BagContents />
    </main>
  );
}
