// Makes the pre-sized WebP copies of the homepage's editorial photos (Shop by category and Shop by aesthetic), using
// cwebp, so no image service or Worker work is needed: the plain <img> in EditorialImage.tsx picks a size from srcset.
// The owner confirmed on 8 Nov 2026 that NÉVORA owns or licenses these photos. Masters stay outside the project; each
// file in the source folder is named after its target, e.g. jewellery-gold-tone-flat-lay.jpg.
//   node scripts/make-editorial-images.mjs <source folder>
// It prints each image's widths and height for src/lib/editorial-images.ts. Changing a photo means a new file name.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const IMAGES = {
  categories: ["jewellery-gold-tone-flat-lay", "hair-accessories-satin-scrunchies-pearl-clips"],
  aesthetics: ["korean-edit-pearl-hair-clips", "coquette-edit-pearl-necklaces", "minimal-edit-gold-tone-travertine"],
};
// Pre-made widths. Sizes larger than the master are skipped, and the master's own width is added instead.
const WIDTHS = [480, 800, 1200, 1600];
// Optional crop of a master before resizing, as [x, y, width, height]. The Korean Edit master has white margins down
// both sides (content runs from x 89 to 1008 of 1100), which showed as white bars in the landscape phone crop.
const CROPS = { "korean-edit-pearl-hair-clips": [92, 0, 914, 1100] };

const src = process.argv[2];
if (!src || !existsSync(src)) throw new Error("Usage: node scripts/make-editorial-images.mjs <source folder>");
const files = readdirSync(src);
const size = (file) => {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], { encoding: "utf8" });
  return [Number(out.match(/pixelWidth: (\d+)/)[1]), Number(out.match(/pixelHeight: (\d+)/)[1])];
};

for (const [group, names] of Object.entries(IMAGES)) {
  const out = new URL(`../public/images/${group}/`, import.meta.url).pathname;
  mkdirSync(out, { recursive: true });
  for (const name of names) {
    const master = files.find((f) => f.replace(/\.[^.]+$/, "") === name);
    if (!master) throw new Error(`Missing master for ${name} in ${src}`);
    const crop = CROPS[name];
    const [w, h] = crop ? crop.slice(2) : size(join(src, master));
    const widths = WIDTHS.filter((x) => x <= w);
    if (widths.at(-1) < Math.min(w, WIDTHS.at(-1))) widths.push(w);
    for (const x of widths) {
      // cwebp copies no metadata by default, so camera and location details never reach the site.
      execFileSync("cwebp", ["-quiet", "-q", "78", "-m", "6", ...(crop ? ["-crop", ...crop.map(String)] : []), "-resize", String(x), "0", join(src, master), "-o", join(out, `${name}-${x}w.webp`)]);
    }
    console.log(`${group}/${name}: widths [${widths.join(", ")}], ${crop ? "cropped" : "master"} ${w} × ${h}`);
  }
}
