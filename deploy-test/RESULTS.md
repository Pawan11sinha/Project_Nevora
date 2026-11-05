# Phase 1a results

**Superseded for OpenNext by `../CLOUDFLARE_COMPATIBILITY_REPORT.md`, which holds real Worker CPU results.** This file remains as the record of the earlier local OpenNext and vinext comparison. vinext hasn't been deployed or measured on Cloudflare.

Status when written: local tests were done, and real CPU hadn't run.

Tested on 5 November 2026 with Next.js 16.4.5, @opennextjs/cloudflare 1.20.16, vinext 1.4.3, @vinext/cloudflare 1.3.3 and wrangler 4.157.0.

## Comparison so far

| | OpenNext | vinext |
|---|---|---|
| Status | Stable release line (1.x). Node `proxy.ts` is flagged at build as "experimental in cloudflare, and not officially maintained by OpenNext maintainers". | Cloudflare docs say beta. It also pulls in beta dependencies: `@cloudflare/vite-plugin` 2.0 beta and `cf` 1.0 beta. |
| Runtime | Real Next.js | Reimplementation on Vite |
| Compatibility check | No equivalent tool | `vinext check`: 94%, with 2 partial items and 0 issues |
| Worker size, compressed | 1,572 KiB (`wrangler --dry-run`) | About 440 KiB (gzip of the build output, not a wrangler figure) |
| Worker size, raw | 7,532 KiB | About 1,496 KiB |
| Fits 3 MiB, the stricter figure | Yes | Yes |
| Cloudflare's position | Mainly for existing apps | Recommended default |
| Real CPU on Workers | **Not tested** | **Not tested** |

## Local tests (Cloudflare's local runtime and installed Chrome at 360px)

| Test | OpenNext | vinext |
|---|---|---|
| 15 smoke checks, 5 runs each | Pass | Pass |
| Static, cached and on-demand pages | Pass | Pass |
| Server-rendered page with 48 products | Pass | Pass |
| Route handler, 404 pages, sitemap | Pass | Pass |
| `proxy.ts` redirects on `/admin` and `/account` | Pass | Pass |
| Tailwind and fonts | Pass | Pass |
| Hydration and client navigation | Pass | Pass |
| Server action with Zod | Pass | Pass |
| No prefetch requests on listing pages | Pass | Pass |
| No sideways scroll at 360px | Pass | Pass |
| `next/image` with a custom loader | Pass | **Fail: ignored, image returned 400** |
| Plain responsive image component | Pass | Pass |
| Serves prerendered pages from cache | Pass | Pass |

Local response times aren't CPU measurements, so they aren't compared here.

## Findings that affect the plan

1. **`next/image` custom loaders don't work under vinext.** A plain responsive `<img>` component works under both and needs no image service. Proposed: use it in the store instead of `next/image`.
2. **`proxy.ts` is a risk under OpenNext.** Next.js 16 runs it on the Node runtime only, and OpenNext warns that this is experimental and unmaintained. It passed locally. Proposed either way: pages and actions check the session and role themselves, as the test app does, so `proxy.ts` is never the only protection. It may be possible to drop it entirely.
3. **The Next.js template turns on `cacheComponents` and `partialPrefetching` by default.** The store must turn them off, under the portability rule.
4. **OpenNext's cache is filled by its own `preview` and `deploy` commands.** Starting the Worker with plain `wrangler dev` caused cache misses and re-rendering. Always use its commands.
5. **Under vinext, all page requests go through the Worker** (`runWorkerFirst` is `/*`, except `/_next/static/*`). Files in `public/` and prerendered pages count against the daily limit, unlike plain static assets. Check on the real deployment.
6. **Neither adapter caches on-demand pages with a read-only cache.** Products not prerendered at build were re-rendered each time. KV could fix this (free: 1,000 writes a day). Still to be tested.
7. **Backups need a tool that isn't installed.** `pg_dump`, `psql` and Docker are all missing on this Mac.

## Not tested yet

| Test | Needs |
|---|---|
| Real CPU per request and 1102 errors | Cloudflare login |
| Cold start and deploy on the Free plan | Cloudflare login |
| What runs the Worker, and what doesn't, in production | Cloudflare login |
| ISR writes and revalidation with KV | Cloudflare login |
| Environment values reaching server code | Supabase values |
| Database function from a Worker, and the last-unit race | Supabase test project |
| Login, session refresh, customer blocked from admin | Supabase test users |
| Email from a Worker | Later, needs Resend and a domain to send to customers |
| Presigned upload to R2 | Owner's approval, as signup may need a card |
| Supabase pause, resume, backup and restore | Owner's actions, plus a backup tool |

## Recommendation

None yet. It depends on the real CPU results.
