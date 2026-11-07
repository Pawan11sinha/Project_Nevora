import { Button, ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

const swatches = [
  { name: "Warm ivory", value: "#F8F5EF", use: "Backgrounds", className: "bg-ivory border border-line", dark: false },
  { name: "Espresso", value: "#34251F", use: "Text, buttons, controls", className: "bg-espresso", dark: true },
  { name: "Champagne gold", value: "#C5A46D", use: "Decoration only", className: "bg-gold", dark: false },
  { name: "Muted taupe", value: "#B9A99A", use: "Decoration only", className: "bg-taupe", dark: false },
];
const supporting = [
  { name: "Cream", value: "#F0EADF", use: "Panels", className: "bg-cream" },
  { name: "Line", value: "#DDD2C4", use: "Dividers only", className: "bg-line" },
  { name: "Soft ink", value: "#6A574C", use: "Secondary text", className: "bg-ink-soft" },
  { name: "Deep gold", value: "#7B5E2B", use: "Small accent text", className: "bg-gold-deep" },
  { name: "Control", value: "#8A7668", use: "Input borders", className: "bg-control" },
];

export default function DesignPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-16 px-5 py-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-deep">Design system</p>
        <h1 className="mt-2 font-serif text-display font-medium leading-none">NÉVORA</h1>
        <p className="mt-4 max-w-xl leading-relaxed text-ink-soft">
          Warm, quiet and modern, with the product doing the talking. Everything on this page comes from shared tokens.
        </p>
      </header>

      <section aria-labelledby="colour" className="space-y-6">
        <SectionHeading id="colour" title="Colour" intro="Gold and taupe are decorative. Text and controls use espresso, soft ink or deep gold." />
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {swatches.map((s) => (
            <li key={s.name}>
              <div className={`h-28 ${s.className}`} />
              <p className="mt-2 text-sm font-semibold">{s.name}</p>
              <p className="text-xs text-ink-soft">{s.value}. {s.use}</p>
            </li>
          ))}
        </ul>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {supporting.map((s) => (
            <li key={s.name}>
              <div className={`h-14 ${s.className}`} />
              <p className="mt-2 text-sm font-semibold">{s.name}</p>
              <p className="text-xs text-ink-soft">{s.value}. {s.use}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type" className="space-y-6">
        <SectionHeading id="type" title="Typography" intro="Cormorant Garamond for editorial headings, and Manrope for clear body text." />
        <div className="space-y-5 border-t border-line pt-6">
          <p className="font-serif text-display font-medium leading-none">Everyday shine</p>
          <p className="font-serif text-title font-medium leading-tight">New this week</p>
          <p className="font-serif text-heading font-medium italic">The Korean edit</p>
          <p className="max-w-xl leading-relaxed">
            Body text is set in Manrope, for easy reading on phones. Oxidised jhumkas and pearl studs, in small batches.
          </p>
          <p className="text-sm text-ink-soft">Secondary text uses soft ink.</p>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-deep">Small accent label</p>
        </div>
      </section>

      <section aria-labelledby="controls" className="space-y-6">
        <SectionHeading id="controls" title="Controls" />
        <div className="flex flex-wrap items-center gap-4">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <ButtonLink href="/design" variant="quiet">Quiet link</ButtonLink>
          <Button disabled>Disabled</Button>
        </div>
        <label className="block max-w-sm text-sm font-semibold">
          Input label
          <input className="mt-1 min-h-11 w-full border border-control bg-ivory px-3 font-normal" placeholder="Example" />
        </label>
      </section>
    </main>
  );
}
