import { notFound } from "next/navigation";
import { ListingPage } from "@/components/catalogue/ListingPage";
import { productsInCategory, visibleCategories } from "@/lib/sample-catalogue";

export const dynamicParams = false;
export const generateStaticParams = () => visibleCategories().map((c) => ({ slug: c.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${visibleCategories().find((c) => c.slug === slug)?.name ?? "Category"} (sample)` };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = visibleCategories().find((c) => c.slug === slug);
  if (!category) notFound();
  return (
    <ListingPage
      title={category.name}
      intro={category.intro}
      products={productsInCategory(slug)}
      crumbs={[{ href: "/", label: "Home" }, { label: category.name }]}
      chips={[{ href: `/categories/${slug}`, label: "All", current: true }, ...category.subcategories.map((s) => ({ href: `/categories/${slug}/${s.slug}`, label: s.name }))]}
    />
  );
}
