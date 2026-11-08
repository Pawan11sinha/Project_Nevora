import { notFound, redirect } from "next/navigation";
import { ListingPage } from "@/components/catalogue/ListingPage";
import { unavailableCollectionSlugs } from "@/lib/features";
import { COLLECTIONS, productsInCollection } from "@/lib/sample-catalogue";

// A collection with no products doesn't exist as a page.
const live = () => COLLECTIONS.filter((c) => productsInCollection(c).length > 0);
// URLs of planned, disabled or empty features (src/lib/features.ts) redirect to the homepage; any other unknown slug is a 404.
const redirected = () => unavailableCollectionSlugs().filter((slug) => !live().some((c) => c.slug === slug));

export const dynamicParams = false;
export const generateStaticParams = () => [...live(), ...redirected().map((slug) => ({ slug }))].map((c) => ({ slug: c.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${live().find((c) => c.slug === slug)?.name ?? "Collection"} (sample)` };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (redirected().includes(slug)) redirect("/");
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
