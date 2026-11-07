"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NavData } from "./navigation";
import { ChevronIcon } from "./icons";

type Panel = "categories" | "aesthetics" | "more" | null;

const itemClass = "inline-flex min-h-11 items-center gap-1 text-[13px] font-medium uppercase tracking-[0.12em] hover:underline hover:decoration-gold hover:underline-offset-8";

export function DesktopNav({ nav }: { nav: NavData }) {
  const [open, setOpen] = useState<Panel>(null);
  const root = useRef<HTMLElement>(null);
  const triggers = useRef<Partial<Record<NonNullable<Panel>, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        triggers.current[open]?.focus();
        setOpen(null);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const trigger = (panel: NonNullable<Panel>, label: string) => (
    <button
      ref={(el) => { triggers.current[panel] = el; }}
      type="button"
      aria-expanded={open === panel}
      aria-controls={`nav-panel-${panel}`}
      onClick={() => setOpen(open === panel ? null : panel)}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(panel); }}
      className={itemClass}
    >
      {label}
      <ChevronIcon />
    </button>
  );
  const close = () => setOpen(null);
  const linkClass = "block py-1.5 text-sm hover:underline hover:decoration-gold hover:underline-offset-4";

  return (
    <nav ref={root} aria-label="Main" className="hidden lg:block" onPointerLeave={(e) => { if (e.pointerType === "mouse") close(); }}>
      <ul className="flex items-center gap-8">
        {nav.primary[0] && <li><Link prefetch={false} href={nav.primary[0].href} className={itemClass} onPointerEnter={close}>{nav.primary[0].label}</Link></li>}
        <li>
          {trigger("categories", "Categories")}
          <div id="nav-panel-categories" hidden={open !== "categories"} className="absolute inset-x-0 top-full border-y border-line bg-ivory shadow-[0_18px_30px_-20px_rgba(52,37,31,0.25)]">
        <div className="mx-auto grid max-w-7xl grid-cols-4 gap-10 px-8 py-9">
          {nav.categories.map((c) => (
            <div key={c.href}>
              <Link prefetch={false} href={c.href} onClick={close} className="font-serif text-2xl font-medium hover:underline hover:decoration-gold hover:underline-offset-4">{c.name}</Link>
              <ul className="mt-3">{c.links.map((l) => <li key={l.href}><Link prefetch={false} href={l.href} onClick={close} className={linkClass}>{l.label}</Link></li>)}</ul>
            </div>
          ))}
          {nav.prices.length > 0 && (
            <div>
              <p className="font-serif text-2xl font-medium">By Price</p>
              <ul className="mt-3">{nav.prices.map((l) => <li key={l.href}><Link prefetch={false} href={l.href} onClick={close} className={linkClass}>{l.label}</Link></li>)}</ul>
            </div>
          )}
          {nav.aesthetics.length > 0 && (
            <div className="bg-cream p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-deep">Find your look</p>
              <ul className="mt-3">{nav.aesthetics.map((l) => <li key={l.href}><Link prefetch={false} href={l.href} onClick={close} className="block py-1 font-serif text-xl italic hover:underline hover:decoration-gold hover:underline-offset-4">{l.label}</Link></li>)}</ul>
            </div>
          )}
        </div>
      </div>
        </li>
        {nav.primary.slice(1).map((item) => (
          <li key={item.href}><Link prefetch={false} href={item.href} className={itemClass} onPointerEnter={close}>{item.label}</Link></li>
        ))}
        {nav.aesthetics.length > 0 && (
          <li>
            {trigger("aesthetics", "Shop by Aesthetic")}
            <div id="nav-panel-aesthetics" hidden={open !== "aesthetics"} className="absolute inset-x-0 top-full border-y border-line bg-ivory shadow-[0_18px_30px_-20px_rgba(52,37,31,0.25)]">
        <ul className="mx-auto flex max-w-7xl flex-wrap gap-x-12 gap-y-2 px-8 py-8">
          {[...nav.aesthetics, ...nav.prices].map((l) => <li key={l.href}><Link prefetch={false} href={l.href} onClick={close} className="font-serif text-2xl italic hover:underline hover:decoration-gold hover:underline-offset-4">{l.label}</Link></li>)}
        </ul>
      </div>
          </li>
        )}
        <li>
          {trigger("more", "More")}
          <div id="nav-panel-more" hidden={open !== "more"} className="absolute inset-x-0 top-full border-y border-line bg-ivory shadow-[0_18px_30px_-20px_rgba(52,37,31,0.25)]">
        <ul className="mx-auto flex max-w-7xl flex-wrap gap-x-10 px-8 py-7">
          {nav.info.map((l) => <li key={l.href}><Link prefetch={false} href={l.href} onClick={close} className={linkClass}>{l.label}</Link></li>)}
        </ul>
      </div>
        </li>
      </ul>

    </nav>
  );
}
