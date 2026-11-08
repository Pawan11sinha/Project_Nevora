"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRotation } from "@/components/ui/useRotation";
import { ROTATION_MS, type Campaign } from "@/lib/sample-campaigns";

// Full-width campaign carousel for the homepage hero (roadmap M4b).
// - Server-rendered as a row of slides you can swipe or scroll, so nothing waits for JavaScript.
// - Once JavaScript runs, the slides stack and fade every ROTATION_MS, with pause, previous, next and slide dots.
// - Timing, pausing and reduced motion come from useRotation, shared with the announcement bar.
// - Each slide is one link; the controls sit outside the links, so they never open them.

const icon = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const ArrowLeft = () => <svg {...icon}><path d="M15 6l-6 6 6 6" /></svg>;
const ArrowRight = () => <svg {...icon}><path d="M9 6l6 6-6 6" /></svg>;
const PauseIcon = () => <svg {...icon}><path d="M9 6v12M15 6v12" /></svg>;
const PlayIcon = () => <svg {...icon}><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" /></svg>;

const control = "pointer-events-auto inline-flex size-11 items-center justify-center rounded-full border border-line bg-ivory/90 text-espresso shadow-sm backdrop-blur transition-colors duration-200 hover:bg-ivory";

export function HeroCarousel({ slides }: { slides: Campaign[] }) {
  const count = slides.length;
  const { enhanced, index, running, wantsToPlay, go, togglePlay, pauseHandlers } = useRotation(count, ROTATION_MS);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured campaigns"
      className="relative w-full bg-cream"
      {...pauseHandlers}
    >
      <h1 className="sr-only">NÉVORA jewellery and hair accessories</h1>
      <div
        id="hero-slides"
        aria-live={running ? "off" : "polite"}
        className={enhanced ? "grid touch-pan-y select-none" : "flex snap-x snap-mandatory overflow-x-auto"}
        onPointerDown={(e) => { if (e.isPrimary) swipe.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => {
          const start = swipe.current;
          swipe.current = null;
          if (!enhanced || !start) return;
          const dx = e.clientX - start.x;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
            swiped.current = true;
            go(dx < 0 ? index + 1 : index - 1);
          }
        }}
        onClickCapture={(e) => {
          // A swipe that ends on a slide mustn't also open it.
          if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; }
        }}
      >
        {slides.map((slide, i) => {
          const active = i === index;
          const hidden = enhanced && !active;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}: ${slide.heading}`}
              aria-hidden={hidden || undefined}
              inert={hidden || undefined}
              className={enhanced
                ? `[grid-area:1/1] transition-[opacity,visibility] duration-700 ease-gentle ${active ? "visible opacity-100" : "invisible opacity-0"}`
                : "w-full shrink-0 snap-center"}
            >
              <Link
                prefetch={false}
                href={slide.href}
                draggable={false}
                className="group relative block aspect-[3/4] overflow-hidden sm:aspect-[4/3] md:aspect-[16/9] lg:aspect-[2/1] xl:aspect-[12/5]"
              >
                <picture>
                  <source media="(min-width: 768px)" srcSet={slide.image.desktop} />
                  {/* A plain responsive image, with no image service (CLAUDE.md). */}
                  <img
                    src={slide.image.mobile}
                    alt={slide.image.alt}
                    width={1080}
                    height={1350}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "low"}
                    decoding="async"
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-cover object-bottom transition-transform duration-[1600ms] ease-gentle group-hover:scale-[1.015] md:object-right"
                  />
                </picture>
                {/* A soft ivory wash keeps the text legible over any artwork or photograph. */}
                <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,245,239,.94)_0%,rgba(248,245,239,.78)_42%,rgba(248,245,239,0)_68%)] md:bg-[linear-gradient(90deg,rgba(248,245,239,.95)_0%,rgba(248,245,239,.8)_42%,rgba(248,245,239,0)_64%)]" />
                <div className="relative flex h-full max-w-xl flex-col px-6 pb-20 pt-6 sm:px-10 md:max-w-[56%] md:justify-center md:py-12 md:pb-12 md:pl-12 lg:max-w-[52%] lg:pl-20 xl:pl-28">
                  <span className="self-start rounded-full border border-espresso/40 bg-ivory/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em]">
                    {slide.sampleLabel}
                  </span>
                  <span aria-hidden="true" className="mt-4 block h-px w-12 bg-gold md:mt-6" />
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-gold-deep md:mt-4">{slide.eyebrow}</p>
                  <h2 className="mt-2 font-serif text-[2rem] font-medium leading-[1.04] sm:text-[2.4rem] md:mt-3 md:text-[2.6rem] lg:text-[3.4rem] lg:leading-[1] xl:text-[4.1rem]">{slide.heading}</h2>
                  <p className="mt-3 max-w-md leading-relaxed text-ink-soft md:mt-4">{slide.description}</p>
                  <span className="mt-5 inline-flex min-h-11 items-center gap-2 self-start bg-espresso px-6 text-sm font-semibold tracking-wide text-ivory transition-colors duration-200 group-hover:bg-espresso-deep">
                    {slide.cta}
                    <span aria-hidden="true" className="transition-transform duration-300 ease-gentle group-hover:translate-x-1">&rarr;</span>
                  </span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {enhanced && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 pb-4 sm:px-8 md:justify-end md:pb-6 lg:px-12">
          <div className="pointer-events-auto flex items-center rounded-full bg-ivory/80 px-1 backdrop-blur">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Show slide ${i + 1} of ${count}: ${slide.heading}`}
                aria-current={i === index ? "true" : undefined}
                aria-controls="hero-slides"
                onClick={() => go(i)}
                className="inline-flex h-8 w-8 items-center justify-center"
              >
                <span aria-hidden="true" className={`block h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-espresso" : "w-1.5 bg-espresso/40"}`} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-controls="hero-slides" onClick={togglePlay} aria-label={wantsToPlay ? "Pause slideshow" : "Play slideshow"} className={control}>
              {wantsToPlay ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" aria-controls="hero-slides" aria-label="Previous slide" onClick={() => go(index - 1)} className={control}><ArrowLeft /></button>
            <button type="button" aria-controls="hero-slides" aria-label="Next slide" onClick={() => go(index + 1)} className={control}><ArrowRight /></button>
          </div>
        </div>
      )}
    </section>
  );
}
