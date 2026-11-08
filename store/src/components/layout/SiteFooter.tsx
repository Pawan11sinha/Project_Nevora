import Link from "next/link";
import { buildFooter } from "./navigation";

export function SiteFooter() {
  const groups = buildFooter();
  return (
    <footer className="mt-24 bg-espresso text-ivory">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-5 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)] lg:px-8">
        <div className="col-span-2 md:col-span-1">
          <p className="font-serif text-3xl font-medium tracking-[0.08em]">NÉVORA</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#e4dacd]">A little shine, every day. This is a local design prototype, and the brand name is still subject to trademark checks.</p>
        </div>
        {groups.map((g) => (
          <nav key={g.title} aria-labelledby={`footer-${g.title.toLowerCase()}`}>
            <h2 id={`footer-${g.title.toLowerCase()}`} className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d9c49c]">{g.title}</h2>
            <ul className="mt-3">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link prefetch={false} href={l.href} className="inline-flex min-h-11 items-center text-sm hover:underline hover:underline-offset-4 md:min-h-8">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
