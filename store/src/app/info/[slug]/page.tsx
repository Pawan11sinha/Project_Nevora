import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

// Placeholders only. Real policy text comes after courier, CA and legal review.
const PAGES: Record<string, string> = { shipping: "Shipping", returns: "Returns & Refunds", contact: "Contact", about: "About NÉVORA" };

export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(PAGES).map((slug) => ({ slug }));

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = PAGES[slug];
  if (!title) notFound();
  return (
    <main className="mx-auto max-w-3xl px-5 pb-6 pt-5">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: title }]} />
      <h1 className="mt-5 font-serif text-title font-medium leading-[1.05]">{title}</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">Placeholder for the prototype. Real text is added before launch, after courier, CA and legal review.</p>
    </main>
  );
}
