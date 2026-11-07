import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Read-only cache: pages pre-rendered at build are served from static assets, and nothing is written at runtime.
// KV stays off until real Worker CPU has been measured and the owner has approved it (see docs/PROJECT_ARCHITECTURE.md).
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
