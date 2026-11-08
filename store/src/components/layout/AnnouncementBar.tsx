"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useHydrated, useMediaQuery } from "@/components/ui/useRotation";
import { TICKER_SPEED_PX_PER_SECOND, type Announcement } from "@/lib/sample-announcements";

// Slim announcement ticker above the navigation: all messages scroll continuously from right to left, separated by
// small gold diamonds, with a permanent "Sample" label.
// - The list is repeated so the loop is seamless; only the first copy is read by screen readers or reachable by keyboard.
// - It pauses on mouse hover and keyboard focus, and has a visible pause/play control (WCAG 2.2.2).
// - It only moves after JavaScript runs. Without JavaScript, or for visitors who prefer reduced motion, the messages
//   are a still row you can scroll sideways. Reduced-motion visitors can still press Play.

const icon = { width: 12, height: 12, viewBox: "0 0 24 24", "aria-hidden": true } as const;
const COPIES = 4; // the track moves by half its width, so each half holds two copies, wider than any screen

function Messages({ messages, copy }: { messages: Announcement[]; copy: number }) {
  const hidden = copy > 0;
  return (
    <ul aria-hidden={hidden || undefined} inert={hidden || undefined} className="flex shrink-0 items-center">
      {messages.map((m) => (
        <li key={m.id} className="flex items-center whitespace-nowrap text-[0.68rem] uppercase tracking-[0.16em]">
          <span aria-hidden="true" className="mx-6 inline-block size-1.5 rotate-45 bg-gold" />
          {m.link ? (
            <Link prefetch={false} href={m.link.href} className="inline-flex min-h-6 items-center hover:text-cream">
              {m.text}
              <span className="ml-2 font-semibold underline decoration-gold underline-offset-4">{m.link.label}</span>
            </Link>
          ) : m.text}
        </li>
      ))}
    </ul>
  );
}

export function AnnouncementBar({ messages }: { messages: Announcement[] }) {
  const hydrated = useHydrated();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // "auto" follows the visitor's motion setting; "play" and "pause" are their explicit choice.
  const [choice, setChoice] = useState<"auto" | "play" | "pause">("auto");
  const track = useRef<HTMLDivElement>(null);
  const moving = hydrated && messages.length > 0 && (choice === "play" || (choice !== "pause" && !reducedMotion));
  // Once started, pausing freezes the ticker where it is rather than resetting it.
  const ticker = hydrated && messages.length > 0 && (moving || (choice === "pause" && !reducedMotion));

  // Keep the speed constant whatever the screen or text width: duration = distance / speed.
  useEffect(() => {
    const el = track.current;
    if (!el || !ticker) return;
    // "important" so the site-wide reduced-motion rule can't cut it short when a visitor explicitly presses Play.
    const update = () => {
      el.style.setProperty("animation-duration", `${el.scrollWidth / 2 / TICKER_SPEED_PX_PER_SECOND}s`, "important");
      el.style.setProperty("animation-iteration-count", "infinite", "important");
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ticker]);

  if (messages.length === 0) return null;
  return (
    <aside aria-label="Announcements" className="bg-espresso text-ivory">
      <div className="flex h-9 items-center gap-2 pl-3 pr-1 sm:pl-5 sm:pr-3">
        <span className="z-10 shrink-0 rounded-full border border-gold/70 px-2 py-px text-[0.6rem] font-semibold uppercase tracking-[0.18em]">
          Sample<span className="sr-only"> announcements</span>
        </span>
        <div className="group min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_28px,#000_calc(100%-28px),transparent)]">
          <div
            ref={track}
            id="announcement-messages"
            data-moving={moving || undefined}
            className={ticker
              ? `ticker-track flex w-max ${moving ? "group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]" : "[animation-play-state:paused]"}`
              : "flex overflow-x-auto [scrollbar-width:none]"}
          >
            {Array.from({ length: ticker ? COPIES : 1 }, (_, copy) => <Messages key={copy} messages={messages} copy={copy} />)}
          </div>
        </div>
        {hydrated && (
          <button
            type="button"
            onClick={() => setChoice(moving ? "pause" : "play")}
            aria-controls="announcement-messages"
            aria-label={moving ? "Pause announcements" : "Play announcements"}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ivory/80 hover:bg-ivory/10 hover:text-ivory"
          >
            {moving
              ? <svg {...icon} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6v12M15 6v12" /></svg>
              : <svg {...icon} fill="currentColor"><path d="M8 5.5v13l10.5-6.5z" /></svg>}
          </button>
        )}
      </div>
    </aside>
  );
}
