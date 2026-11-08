import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

// Placeholders only, and visibly marked as such. Real text comes after courier, CA and legal review; Privacy and Terms
// in particular are not policies and must never be presented as final until a lawyer or CA has approved the text.
const PAGES: Record<string, { title: string; legal?: boolean }> = {
  shipping: { title: "Shipping" },
  returns: { title: "Returns & Refunds" },
  contact: { title: "Contact" },
  about: { title: "About NÉVORA" },
  privacy: { title: "Privacy Policy", legal: true },
  terms: { title: "Terms & Conditions", legal: true },
};

export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(PAGES).map((slug) => ({ slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${PAGES[slug]?.title ?? "Information"} (placeholder)`, robots: { index: false, follow: true } };
}

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  return (
    <main className="mx-auto max-w-3xl px-5 pb-6 pt-5">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: page.title }]} />
      <p className="mt-5 inline-block rounded-full border border-gold px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">Placeholder · Not final</p>
      <h1 className="mt-4 font-serif text-title font-medium leading-[1.05]">{page.title}</h1>
      {page.legal ? (
        <div className="mt-4 space-y-3 leading-relaxed text-ink-soft">
          <p>
            <strong className="font-semibold text-espresso">This is an unfinished placeholder, not NÉVORA&rsquo;s {page.title.toLowerCase()}.</strong>{" "}
            It has no legal effect, and nothing on this page should be relied on.
          </p>
          <p>The final text will be published here before launch, once it has been reviewed by a lawyer or chartered accountant.</p>
        </div>
      ) : (
        <p className="mt-4 leading-relaxed text-ink-soft">This page is an unfinished placeholder. Real text is added before launch, after courier, CA and legal review.</p>
      )}
    </main>
  );
}
