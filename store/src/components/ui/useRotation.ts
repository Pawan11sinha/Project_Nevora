"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Timing for content that rotates on its own (the hero carousel; the announcement ticker uses useHydrated and
// useMediaQuery from here):
// - only after JavaScript has run, and only with more than one item;
// - pauses on mouse hover, keyboard focus and a hidden tab;
// - doesn't start for visitors who prefer reduced motion, though they can still press Play;
// - a visible pause/play control is expected wherever this is used (WCAG 2.2.2).

const subscribeNothing = () => () => {};

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function useTabHidden() {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener("visibilitychange", onChange);
      return () => document.removeEventListener("visibilitychange", onChange);
    },
    () => document.hidden,
    () => false,
  );
}

/** True once the page has hydrated in the browser; false on the server and in the first render. */
export function useHydrated() {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

export function useRotation(count: number, intervalMs: number) {
  const hydrated = useHydrated();
  const enhanced = hydrated && count > 1;
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const tabHidden = useTabHidden();
  const [index, setIndex] = useState(0);
  // "auto" follows the visitor's motion setting; "play" and "pause" are their explicit choice.
  const [choice, setChoice] = useState<"auto" | "play" | "pause">("auto");
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);

  const wantsToPlay = choice === "play" || (choice === "auto" && !reducedMotion);
  const running = enhanced && wantsToPlay && !hovered && !keyboardFocus && !tabHidden;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearTimeout(timer);
  }, [running, index, count, intervalMs]);

  return {
    enhanced,
    index,
    running,
    wantsToPlay,
    go: (to: number) => setIndex(((to % count) + count) % count),
    togglePlay: () => setChoice(wantsToPlay ? "pause" : "play"),
    /** Spread onto the element whose hover and focus should pause the rotation. */
    pauseHandlers: {
      onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === "mouse") setHovered(true); },
      onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === "mouse") setHovered(false); },
      onFocus: (e: React.FocusEvent) => { if ((e.target as Element).matches(":focus-visible")) setKeyboardFocus(true); },
      onBlur: (e: React.FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardFocus(false); },
    },
  };
}
