import Link from "next/link";
import { buildNavigation } from "./navigation";

export function SiteFooter() {
  const nav = buildNavigation();
  const column = (title: string, links: { href: string; label: string }[]) => (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d9c49c]">{title}</h2>
      <ul className="mt-3">{links.map((l) => <li key={l.href}><Link prefetch={false} href={l.href} className="inline-flex min-h-11 items-center text-sm hover:underline hover:underline-offset-4 md:min-h-8">{l.label}</Link></li>)}</ul>
    </div>
  );
  return (
    <footer className="mt-24 bg-espresso text-ivory">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4 lg:px-8">
        <div>
          <p className="font-serif text-3xl font-medium tracking-[0.08em]">NÉVORA</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#e4dacd]">A little shine, every day. This is a local design prototype, and the brand name is still subject to trademark checks.</p>
        </div>
        {column("Shop", nav.categories.map((c) => ({ href: c.href, label: c.name })))}
        {column("Looks", [...nav.aesthetics, ...nav.prices])}
        {column("Help", nav.info)}
      </div>
    </footer>
  );
}
