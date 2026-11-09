"use client";

import Link from "next/link";
import { useRef } from "react";
import type { NavData } from "./navigation";
import { ChevronIcon, CloseIcon, MenuIcon } from "./icons";

const rowClass = "flex min-h-12 items-center justify-between border-b border-line text-[15px] font-medium";

// A native dialog gives focus trapping, Escape to close and a backdrop with no extra JavaScript.
export function MobileNav({ nav }: { nav: NavData }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  const group = (title: string, links: { href: string; label: string }[], extra?: { href: string; label: string }) => (
    <details className="group border-b border-line">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[15px] font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <span className="transition-transform group-open:rotate-180"><ChevronIcon /></span>
      </summary>
      <ul className="pb-3 pl-3">
        {extra && <li><Link prefetch={false} href={extra.href} onClick={close} className="flex min-h-11 items-center text-sm font-semibold">{extra.label}</Link></li>}
        {links.map((l) => <li key={l.href}><Link prefetch={false} href={l.href} onClick={close} className="flex min-h-11 items-center text-sm">{l.label}</Link></li>)}
      </ul>
    </details>
  );

  return (
    <div className="lg:hidden">
      <button type="button" aria-label="Open menu" onClick={() => dialog.current?.showModal()} className="-ml-2 inline-flex size-11 items-center justify-center">
        <MenuIcon />
      </button>
      <dialog ref={dialog} aria-label="Menu" className="m-0 h-dvh max-h-none w-[min(22rem,88vw)] max-w-none bg-ivory text-espresso backdrop:bg-espresso/40">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="font-serif text-2xl font-medium tracking-[0.08em]">NÉVORA</span>
          <button type="button" aria-label="Close menu" onClick={close} className="-mr-2 inline-flex size-11 items-center justify-center"><CloseIcon /></button>
        </div>
        <nav aria-label="Mobile" className="px-5 pb-10">
          {nav.primary[0] && <Link prefetch={false} href={nav.primary[0].href} onClick={close} className={rowClass}>{nav.primary[0].label}</Link>}
          {nav.categories.map((c) => <div key={c.href}>{group(c.name, c.links, { href: c.href, label: `All ${c.name}` })}</div>)}
          {nav.primary.slice(1).map((item) => <Link prefetch={false} key={item.href} href={item.href} onClick={close} className={rowClass}>{item.label}</Link>)}
          {nav.aesthetics.length > 0 && group("Shop by Aesthetic", nav.aesthetics)}
          {nav.prices.length > 0 && group("Shop by Price", nav.prices)}
          {group("More", nav.info)}
          <Link prefetch={false} href="/account" onClick={close} className={rowClass}>Your account</Link>
        </nav>
      </dialog>
    </div>
  );
}
