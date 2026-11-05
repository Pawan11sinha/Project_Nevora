import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/sample-data";

export default function sitemap(): MetadataRoute.Sitemap {
  return CATEGORIES.map((c) => ({ url: `https://example.com/c/${c.slug}` }));
}
