import { srcOf, srcSetOf, type EditorialImage as Image } from "@/lib/editorial-images";

// A plain responsive <img>: the browser picks a pre-made WebP size from srcset, so there's no image service and no
// Worker work. Width and height reserve the space before it loads; the card's aspect class then crops it with
// object-cover, using the image's own object-position.
export function EditorialImage({ image, sizes, priority = false, className = "" }: { image: Image; sizes: string; priority?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={srcOf(image, image.widths[Math.min(1, image.widths.length - 1)])}
      srcSet={srcSetOf(image)}
      sizes={sizes}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      style={{ objectPosition: image.position }}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
