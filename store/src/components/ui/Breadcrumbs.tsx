import Link from "next/link";

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
        {items.map((item, i) => (
          <li key={item.label} className="flex min-h-8 items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? <Link prefetch={false} href={item.href} className="underline-offset-4 hover:underline">{item.label}</Link> : <span aria-current="page" className="text-espresso">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
