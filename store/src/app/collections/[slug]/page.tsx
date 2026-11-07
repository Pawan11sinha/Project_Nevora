import { notFound } from "next/navigation";
import { ListingPage } from "@/components/catalogue/ListingPage";
import { COLLECTIONS, productsInCollection } from "@/lib/sample-catalogue";

// A collection with no products doesn't exist as a page.
const live = () => COLLECTIONS.filter((c) => productsInCollection(c).length > 0);

export const dynamicParams = false;
export const generateStaticParams = () => live().map((c) => ({ slug: c.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${live().find((c) => c.slug === slug)?.name ?? "Collection"} (sample)` };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = live().find((c) => c.slug === slug);
  if (!collection) notFound();
  const eyebrow = { aesthetic: "Shop by aesthetic", price: "Shop by price", merchandising: undefined }[collection.group];
  return (
    <ListingPage
      eyebrow={eyebrow}
      title={collection.name}
      intro={collection.intro}
      products={productsInCollection(collection)}
      crumbs={[{ href: "/", label: "Home" }, { label: collection.name }]}
      showLabel={slug === "trending"}
    />
  );
}
