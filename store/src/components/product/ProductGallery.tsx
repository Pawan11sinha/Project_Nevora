"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { GalleryImage } from "@/lib/sample-catalogue";

// Product page gallery: one large image with arrows and a counter, a thumbnail strip, and a full-screen lightbox.
// - Swiping is native horizontal scrolling with snap points, so it follows the finger naturally and works before
//   JavaScript loads (every image stays reachable, nothing is hidden until scripts run).
// - Left and right arrow keys move between images anywhere in the gallery, and in the lightbox (its key presses
//   bubble up to the gallery's handler, so there's one handler for both).
// - The lightbox is a native <dialog>: it traps focus, Escape closes it, and focus returns to the image afterwards.
// - It shows only the images the product has: one image means no arrows, counter or thumbnails. With none, or if an
//   image fails to load, a quiet NÉVORA placeholder takes its place.

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hideScrollbar = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function Placeholder({ small = false }: { small?: boolean }) {
  return (
    <div role="img" aria-label="Image not available" className="grid aspect-[4/5] w-full place-items-center bg-cream text-ink-soft">
      <span className={`font-serif font-medium tracking-[0.12em] ${small ? "text-[0.6rem]" : "text-2xl"}`}>NÉVORA</span>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

export function ProductGallery({ images, name, dimmed = false }: { images: GalleryImage[]; name: string; dimmed?: boolean }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const lightTrack = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const count = images.length;
  const many = count > 1;

  const markFailed = useCallback((src: string) => setFailed((f) => (f.has(src) ? f : new Set(f).add(src))), []);
  // An image that failed before React hydrated never fires onError here, so check once after mounting.
  useEffect(() => {
    track.current?.querySelectorAll("img").forEach((img) => { if (img.complete && img.naturalWidth === 0) markFailed(img.getAttribute("src") ?? ""); });
  }, [markFailed]);

  const scrollTrackTo = (el: HTMLDivElement | null, i: number, smooth: boolean) => el?.scrollTo({ left: i * el.clientWidth, behavior: smooth && !reducedMotion() ? "smooth" : "auto" });

  const goTo = useCallback((i: number) => {
    const next = (i + count) % count;
    setIndex(next);
    scrollTrackTo(track.current, next, true);
    if (dialog.current?.open) scrollTrackTo(lightTrack.current, next, true);
  }, [count]);

  // Keeps the counter and thumbnails in step with swiping: the nearest snapped slide is the current one.
  const onScroll = (el: HTMLDivElement) => {
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== index && i >= 0 && i < count) setIndex(i);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!many || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    goTo(index + (e.key === "ArrowRight" ? 1 : -1));
  };

  const openLightbox = (i: number) => {
    const d = dialog.current;
    if (!d) return;
    setIndex(i);
    d.showModal();
    setOpen(true);
    requestAnimationFrame(() => scrollTrackTo(lightTrack.current, i, false));
  };
  // The dialog would return focus to the image that opened it, but if the visitor moved on in the lightbox that slide
  // is now inert, and focus would fall to the page. So focus goes to the image now showing instead.
  const onLightboxClose = () => {
    setOpen(false);
    scrollTrackTo(track.current, index, false);
    track.current?.querySelectorAll<HTMLButtonElement>('[aria-roledescription="slide"] > button')[index]?.focus({ preventScroll: true });
  };
  // The page behind the lightbox doesn't scroll while it's open.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = ""; };
  }, [open]);

  if (count === 0) return <div className={dimmed ? "opacity-70" : ""}><Placeholder /></div>;

  const counter = (dark: boolean) => (
    <p className={`pointer-events-none rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums tracking-wide ${dark ? "text-ivory" : "absolute bottom-3 left-3 bg-ivory/90 text-espresso shadow-sm"}`}>
      <span aria-hidden="true">{index + 1} / {count}</span>
      {/* Announced once, from the page's counter; the lightbox's copy is visual only. */}
      {!dark && <span className="sr-only" aria-live="polite">Image {index + 1} of {count}</span>}
    </p>
  );
  const arrow = (direction: "left" | "right", dark: boolean) => (
    <button
      type="button"
      onClick={() => goTo(index + (direction === "right" ? 1 : -1))}
      aria-label={direction === "right" ? "Next image" : "Previous image"}
      className={`absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full transition-colors duration-300 ${direction === "left" ? "left-3" : "right-3"} ${dark ? "bg-ivory/15 text-ivory hover:bg-ivory/25" : "bg-ivory/90 text-espresso shadow-sm hover:bg-ivory"}`}
    >
      <Chevron direction={direction} />
    </button>
  );

  return (
    <section aria-roledescription="carousel" aria-label={`${name} images`} onKeyDown={onKeyDown}>
      <div className="relative overflow-hidden rounded-2xl bg-cream">
        <div ref={track} onScroll={(e) => onScroll(e.currentTarget)} className={`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain ${hideScrollbar} ${dimmed ? "opacity-70" : ""}`}>
          {images.map((image, i) => (
            <div key={image.src} className="w-full shrink-0 snap-center snap-always" inert={i !== index} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
              <button type="button" onClick={() => openLightbox(i)} className="block w-full cursor-zoom-in">
                <span className="sr-only">Open larger view: </span>
                {failed.has(image.src) ? <Placeholder /> : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.src}
                    alt={image.alt}
                    width={500}
                    height={625}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : undefined}
                    decoding="async"
                    onError={() => markFailed(image.src)}
                    className="aspect-[4/5] h-auto w-full object-cover"
                  />
                )}
              </button>
            </div>
          ))}
        </div>
        {many && (
          <>
            {arrow("left", false)}
            {arrow("right", false)}
            {counter(false)}
          </>
        )}
      </div>

      {many && (
        <ul className="mt-3 flex gap-2.5 overflow-x-auto pb-1 sm:gap-3" aria-label="Choose an image">
          {images.map((image, i) => (
            <li key={image.src} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show image ${i + 1} of ${count}: ${image.alt}`}
                aria-current={i === index ? "true" : undefined}
                className={`block w-16 overflow-hidden rounded-lg ring-1 transition-[box-shadow,opacity] duration-300 sm:w-20 ${i === index ? "ring-2 ring-espresso" : "opacity-75 ring-line hover:opacity-100"}`}
              >
                {failed.has(image.src) ? <Placeholder small /> : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.src} alt="" width={500} height={625} loading="lazy" decoding="async" className="aspect-[4/5] h-auto w-full bg-cream object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        onClose={onLightboxClose}
        aria-label={`${name} images, larger view`}
        className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-espresso/95 p-0 text-ivory backdrop:bg-espresso/60"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            {many ? counter(true) : <span />}
            <form method="dialog">
              <button type="submit" aria-label="Close larger view" className="grid h-11 w-11 place-items-center rounded-full text-ivory transition-colors duration-300 hover:bg-ivory/15">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </form>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={lightTrack} onScroll={(e) => onScroll(e.currentTarget)} className={`flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain ${hideScrollbar}`}>
              {images.map((image, i) => (
                <div key={image.src} className="grid h-full w-full shrink-0 snap-center snap-always place-items-center px-4 pb-6 sm:px-16" inert={i !== index}>
                  {failed.has(image.src) ? <div className="w-full max-w-md"><Placeholder /></div> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.src} alt={image.alt} width={500} height={625} loading="lazy" decoding="async" className="max-h-full w-auto max-w-full rounded-xl object-contain" />
                  )}
                </div>
              ))}
            </div>
            {many && (
              <>
                {arrow("left", true)}
                {arrow("right", true)}
              </>
            )}
          </div>
        </div>
      </dialog>
    </section>
  );
}
