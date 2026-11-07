import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import type { Product } from "@/lib/sample-catalogue";
import { Browse } from "./Browse";

export function ListingPage({ eyebrow, title, intro, products, crumbs, chips, showLabel = true }: {
  eyebrow?: string;
  title: string;
  intro?: string;
  products: Product[];
  crumbs: { href?: string; label: string }[];
  chips?: { href: string; label: string; current?: boolean }[];
  showLabel?: boolean;
}) {
  return (
    <main className="mx-auto max-w-7xl px-5 pb-6 pt-5 lg:px-8">
      <Breadcrumbs items={crumbs} />
      <header className="mt-5 max-w-2xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-deep">{eyebrow}</p>}
        <h1 className="mt-2 font-serif text-title font-medium leading-[1.05]">{title}</h1>
        {intro && <p className="mt-3 leading-relaxed text-ink-soft">{intro}</p>}
      </header>
      {chips && chips.length > 0 && (
        <nav aria-label="Types" className="-mx-5 mt-6 overflow-x-auto px-5 lg:mx-0 lg:px-0">
          <ul className="flex gap-2 whitespace-nowrap lg:flex-wrap">
            {chips.map((c) => (
              <li key={c.href}>
                <Link prefetch={false} href={c.href} aria-current={c.current ? "page" : undefined} className={`inline-flex min-h-11 items-center border px-4 text-sm transition-colors duration-200 ${c.current ? "border-espresso bg-espresso text-ivory" : "border-control hover:bg-cream"}`}>{c.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="mt-6"><Browse products={products} showLabel={showLabel} /></div>
    </main>
  );
}
