import type { NextConfig } from "next";

// The template's cacheComponents and partialPrefetching defaults are removed on
// purpose: the store sticks to portable Next.js features.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
