// A plain responsive image using pre-made sizes. It needs no image service and
// behaves the same under any adapter, because vinext ignores next/image custom loaders.
const SIZES = [400, 800, 1600];

export function ProductImage({
  base,
  alt,
  sizes,
  priority = false,
}: {
  base: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${base}-800.svg`}
      srcSet={SIZES.map((s) => `${base}-${s}.svg ${s}w`).join(", ")}
      sizes={sizes}
      alt={alt}
      width={800}
      height={800}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className="h-auto w-full rounded"
    />
  );
}
