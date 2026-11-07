import Link from "next/link";
import { BagLink } from "@/components/cart/BagLink";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import { SearchIcon, UserIcon } from "./icons";
import { buildNavigation } from "./navigation";

const actionClass = "size-11 items-center justify-center text-ink-soft";

export function SiteHeader() {
  const nav = buildNavigation();
  return (
    <>
    <aside aria-label="Prototype notice" className="bg-espresso px-4 py-1.5 text-center text-xs tracking-wide text-ivory">
      Prototype: sample products, nothing for sale.
    </aside>
    <header className="sticky top-0 z-40 bg-ivory">
      <div className="relative border-b border-line">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 py-2 lg:grid-cols-[auto_1fr_auto] lg:gap-10 lg:px-8">
          <MobileNav nav={nav} />
          <Link prefetch={false} href="/" className="justify-self-center font-serif text-[1.7rem] font-medium leading-none tracking-[0.08em] lg:order-first lg:justify-self-start">NÉVORA</Link>
          <div className="hidden justify-center lg:flex"><DesktopNav nav={nav} /></div>
          {/* Search and account arrive with later milestones, so they're shown but disabled. */}
          <div className="flex items-center justify-end">
            <button type="button" disabled aria-label="Search, not available in this prototype" className={`${actionClass} hidden cursor-not-allowed sm:inline-flex`}><SearchIcon /></button>
            <button type="button" disabled aria-label="Account, not available in this prototype" className={`${actionClass} hidden cursor-not-allowed sm:inline-flex`}><UserIcon /></button>
            <BagLink className="-mr-2 inline-flex size-11 items-center justify-center text-espresso hover:text-ink-soft" />
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
