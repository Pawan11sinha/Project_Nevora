import { sampleImageSrc, type Art, type ImageView } from "@/lib/sample-catalogue";

// A plain image with fixed dimensions, so there's no layout shift. Real photos will add srcset
// with pre-made sizes, and won't need an image service. view picks which sample shot of the piece (see productImages).
export function ProductImage({ art, alt, priority = false, sizes = "(min-width: 1024px) 25vw, 50vw", view = "main", className = "" }: { art: Art; alt: string; priority?: boolean; sizes?: string; view?: ImageView; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sampleImageSrc(art, view)}
      alt={alt}
      width={500}
      height={625}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={view === "main" ? undefined : "low"}
      className={`aspect-[4/5] h-auto w-full bg-cream object-cover ${className}`}
    />
  );
}
