export function SectionHeading({ eyebrow, title, intro, id }: { eyebrow?: string; title: string; intro?: string; id?: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-deep">{eyebrow}</p>}
      <h2 id={id} className="mt-2 font-serif text-title font-medium leading-[1.05]">
        {title}
      </h2>
      {intro && <p className="mt-3 leading-relaxed text-ink-soft">{intro}</p>}
    </div>
  );
}
