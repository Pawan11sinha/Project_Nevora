import type { Art } from "@/lib/sample-catalogue";

// A plain image with fixed dimensions, so there's no layout shift. Real photos will add srcset
// with pre-made sizes, and won't need an image service.
export function ProductImage({ art, alt, priority = false, sizes = "(min-width: 1024px) 25vw, 50vw" }: { art: Art; alt: string; priority?: boolean; sizes?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/sample/${art}.svg`}
      alt={alt}
      width={500}
      height={625}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className="aspect-[4/5] h-auto w-full bg-cream object-cover"
    />
  );
}
