import { notFound } from "next/navigation";
import { ListingPage } from "@/components/catalogue/ListingPage";
import { productsInSubcategory, visibleCategories } from "@/lib/sample-catalogue";

export const dynamicParams = false;
export const generateStaticParams = () => visibleCategories().flatMap((c) => c.subcategories.map((s) => ({ slug: c.slug, sub: s.slug })));

export async function generateMetadata({ params }: { params: Promise<{ slug: string; sub: string }> }) {
  const { slug, sub } = await params;
  const name = visibleCategories().find((c) => c.slug === slug)?.subcategories.find((s) => s.slug === sub)?.name;
  return { title: `${name ?? "Category"} (sample)` };
}

export default async function SubcategoryPage({ params }: { params: Promise<{ slug: string; sub: string }> }) {
  const { slug, sub } = await params;
  const category = visibleCategories().find((c) => c.slug === slug);
  const current = category?.subcategories.find((s) => s.slug === sub);
  if (!category || !current) notFound();
  return (
    <ListingPage
      eyebrow={category.name}
      title={current.name}
      products={productsInSubcategory(sub)}
      crumbs={[{ href: "/", label: "Home" }, { href: `/categories/${slug}`, label: category.name }, { label: current.name }]}
      chips={[{ href: `/categories/${slug}`, label: "All" }, ...category.subcategories.map((s) => ({ href: `/categories/${slug}/${s.slug}`, label: s.name, current: s.slug === sub }))]}
    />
  );
}
