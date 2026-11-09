import Link from "next/link";
import { BagLink } from "@/components/cart/BagLink";
import { FavouritesLink } from "@/components/wishlist/FavouritesLink";
import { SAMPLE_ANNOUNCEMENTS } from "@/lib/sample-announcements";
import { AnnouncementBar } from "./AnnouncementBar";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import { SearchIcon, UserIcon } from "./icons";
import { buildNavigation } from "./navigation";

const actionClass = "size-11 items-center justify-center text-ink-soft";

export function SiteHeader() {
  const nav = buildNavigation();
  return (
    <>
    {/* Announcement bar: sample messages, with the prototype notice as the first one and a permanent Sample label. */}
    <AnnouncementBar messages={SAMPLE_ANNOUNCEMENTS} />
    <header className="sticky top-0 z-40 bg-ivory">
      <div className="relative border-b border-line">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 py-2 lg:grid-cols-[auto_1fr_auto] lg:gap-10 lg:px-8">
          <MobileNav nav={nav} />
          <Link prefetch={false} href="/" className="justify-self-center font-serif text-[1.7rem] font-medium leading-none tracking-[0.08em] lg:order-first lg:justify-self-start">NÉVORA</Link>
          <div className="hidden justify-center lg:flex"><DesktopNav nav={nav} /></div>
          {/* Search arrives with a later milestone, so it's shown but disabled. The account link is the same for everyone,
              so the header stays pre-rendered: /account sends signed-out visitors to sign in. */}
          <div className="flex items-center justify-end">
            <button type="button" disabled aria-label="Search, not available in this prototype" className={`${actionClass} hidden cursor-not-allowed sm:inline-flex`}><SearchIcon /></button>
            <Link prefetch={false} href="/account" aria-label="Your account" className="hidden size-11 items-center justify-center text-espresso hover:text-ink-soft sm:inline-flex"><UserIcon /></Link>
            <FavouritesLink className="inline-flex size-11 items-center justify-center text-espresso hover:text-ink-soft" />
            <BagLink className="-mr-2 inline-flex size-11 items-center justify-center text-espresso hover:text-ink-soft" />
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
