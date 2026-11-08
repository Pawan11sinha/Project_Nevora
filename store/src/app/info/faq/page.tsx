import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { publishedFaqs } from "@/lib/faqs";

export const metadata = { title: "FAQs" };

// Published answers only (src/lib/faqs.ts). Native <details> elements: they open without JavaScript.
export default function FaqPage() {
  const faqs = publishedFaqs();
  return (
    <main className="mx-auto max-w-3xl px-5 pb-6 pt-5">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "FAQs" }]} />
      <h1 className="mt-5 font-serif text-title font-medium leading-[1.05]">Frequently asked questions</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">More answers are added here as our delivery, returns and care details are confirmed.</p>
      <div className="mt-8 border-t border-line">
        {faqs.map((f) => (
          <details key={f.id} className="group border-b border-line">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-serif text-lg font-medium leading-snug [&::-webkit-details-marker]:hidden">
              {f.question}
              <span aria-hidden="true" className="shrink-0 text-xl leading-none transition-transform duration-300 ease-gentle group-open:rotate-45 motion-reduce:transition-none">+</span>
            </summary>
            <div className="pb-5 pr-8">
              {f.answer!.split("\n\n").map((para, i) => <p key={i} className={`leading-relaxed text-ink-soft ${i ? "mt-3" : ""}`}>{para}</p>)}
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
