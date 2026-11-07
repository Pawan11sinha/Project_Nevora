# NÉVORA architecture

Status: product plan approved by the owner on 6 November 2026. **This describes the planned store, most of which isn't built.** Only the test app in `deploy-test/` and the local UI prototype in `store/` exist. Approval covers the plan only, so implementation and every external change need separate approval. Vendor limits were read from official docs in November 2026, unless marked as an estimate. Recheck them before relying on them.

## 1. Confirmed decisions

| Area | Decision |
|---|---|
| Cost | Use free tiers wherever possible. Pay only when real usage requires it. |
| Capacity target | About 50,000 visits a month. This is an estimate, not a forecast. |
| Positioning | Premium jewellery and Gen-Z trending accessories. Reference sites inspire shopping ideas only, never branding, design or code. |
| Launch scope | The smaller first release in section 1 of `IMPLEMENTATION_ROADMAP.md`, targeting the week of 11 January 2027 |
| Store location | A new `store/` folder. `deploy-test/` stays untouched. |
| Range | Jewellery and hair accessories, as database categories |
| Frontend | Next.js and TypeScript |
| Hosting | Cloudflare Workers, with Workers Static Assets for static files and Cloudflare DNS and SSL for the custom domain (owner decision, 7 November 2026). OpenNext is the initial runtime; vinext is evaluated separately and isn't used without evidence and approval. Workers Free, subject to the CPU decision rule in section 4. Cloudflare Pages isn't used: its Next.js guide covers static exports only. Vercel Hobby won't be used for the production store, because Vercel limits it to non-commercial use. |
| Database | A separate real Supabase project for the store, in Mumbai. The test project is never used for it. Free for building and rehearsals. Pro is budgeted before public launch, with no upgrade authorised. |
| Authentication | Guest checkout, plus optional customer signup and login with Supabase email and password. Admin login is separate, under `/admin`, with mandatory TOTP MFA. |
| Paid hosting | Up to about $5 a month is acceptable if Cloudflare Free fails the test, but only after the owner sees the results and cost and approves. Never upgraded automatically. |
| Brand colours | Warm ivory `#F8F5EF`, espresso `#34251F`, champagne gold `#C5A46D`, muted taupe `#B9A99A`. No teal. |
| Typography | Elegant editorial serif headings, modern sans-serif body text |
| Animation | CSS first. Motion for React (`motion/react`) only where measurement justifies it, and it isn't installed today (see section 6). |
| Product images | Cloudflare R2 free allowance |
| Email | Resend Free |
| Source control | GitHub Free |
| WhatsApp | Optional click-to-chat, never the order database |
| Payment model | **Prepaid manual UPI only in V1.** No COD or payment gateway. The admin verifies every credit in the bank or UPI account. |
| Fulfilment | Arranged manually after payment, with no courier API |
| Domain | Owner will buy it after the brand and trademark checks |
| Admin | Protected `/admin` area in the same app |

## 2. System overview

```text
Phone or desktop browser
   |                    |                  |
   | pages, actions     | images           | prefilled message
   v                    v                  v
Cloudflare Worker     R2 via images.     WhatsApp
(Next.js)             <domain>, cached   (customer presses send)
   |            |
   v            v
Supabase      Resend
Postgres,     order and
Auth,         auth email
private proofs
```

- The browser doesn't talk to Supabase directly at launch. Public data goes through the cached server layer, which reduces database egress and exposure.
- The server has three access paths: a public client (publishable key, no session, catalogue views only), a session client (publishable key and `HttpOnly` cookies, for customers and **all admin actions**), and a service module (secret key, `server-only`, named operations only). See `SECURITY_PLAN.md`.
- Payment, email, WhatsApp and image storage each sit behind a small service module, so Razorpay or a different host can be added later without changing order logic.
- Scheduled work, such as expiring unpaid orders, needs a scheduler that hasn't been chosen. `pg_cron`, Worker cron and GitHub Actions are all unverified, and none is assumed. See section 5.

## 3. Deployment: vinext or OpenNext

**OpenNext is the initial runtime (owner decision, 7 November 2026).** vinext is evaluated separately and isn't adopted without documented evidence and the owner's explicit approval. One reason it isn't first: under vinext, files in `public/` run the Worker, so every PIN code lookup would count against the daily request limit. Both still get the Phase R assessment on the actual NÉVORA routes with Supabase authentication. Nothing is migrated or deployed without approval. Guidance was read on 6 November 2026.

| | vinext | OpenNext (`@opennextjs/cloudflare`) |
|---|---|---|
| Cloudflare's guidance | "Cloudflare recommends vinext... as the default", and "vinext is in beta" (updated 5 Nov 2026) | "Use this guide to maintain an existing OpenNext application. Migrate to vinext when compatibility allows." (updated 12 Oct 2026) |
| Its own project says | "You can, with caution", and "OpenNext is the safer choice" | All Next.js 16 versions are supported |
| What it is | A from-scratch reimplementation on Vite, not the real Next.js runtime | An adapter around the real Next.js build |
| `proxy.ts` | Listed as supported | Cloudflare's guide doesn't mention `proxy.ts`, and lists "Node.js in Middleware" as "Not yet supported" |
| Caching | Pluggable adapters | R2 for the incremental cache, and KV isn't recommended. On-demand revalidation needs D1 or Durable Objects. |
| Risk for `store/` | `next/font` is a gap area. The Turbopack CSS rule and Vite and React peer requirements need checking. | Worker size: its docs say 3 MiB compressed, Cloudflare's limits page says 64 MiB uncompressed with no compressed limit. Confirm with a dry-run deploy. |

**Decision tests, identical for both:** CPU on real routes with zero `exceededCpu` kills across at least 1,000 captured requests per critical route, login and cookie refresh, AAL2, server actions, caching, Worker size and cold start. Stage 4 results only cover OpenNext with the test app, so they can't decide this alone. Production use of vinext also needs documented evidence and the owner's explicit approval.

**Stay portable.** App code uses only ordinary Next.js features: no PPR, no `"use cache"` and no native modules such as `sharp`. That keeps moving between adapters or hosts cheap.

### Cloudflare configuration in `store/` (staging deployed 7 November 2026; production not deployed)

The owner chose OpenNext on Workers for the initial deployment. The configuration in `store/` was first validated locally with `opennextjs-cloudflare preview`, then deployed, with the owner's approval of each step, to the **staging** Worker `nevora-store-staging` on its `workers.dev` address, behind the staging password gate described below. **Production isn't deployed:** there's no production Worker, route, custom domain or DNS change.

| File | Purpose |
|---|---|
| `wrangler.jsonc` | **Staging only**: Worker `nevora-store-staging` on `workers.dev`. No routes, custom domain or production environment; those come in a separate, approved step. Static assets first (`run_worker_first` left at its default, false). Invocation logs off, because they record visitor IP addresses. |
| `open-next.config.ts` | Read-only cache served from static assets. KV stays off. |
| `custom-worker.ts`, `src/lib/staging-gate.ts`, `src/lib/url-guard.ts` | The staging password gate first, then 400 instead of Next.js's 500 for undecodable paths |
| `public/_headers` | Headers for static files, which never run the Worker: nosniff, `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`, `X-Robots-Tag: noindex`, a year's immutable cache for `/_next/static/*` and `/data/pin/v1/*`, UTF-8 for the PIN notice |
| `next.config.ts` | The same security headers for Worker-generated pages, plus CSP, `X-Frame-Options: DENY` and HSTS at one day without `includeSubDomains`, raised only after the custom domain is verified |
| `scripts/check-deploy.mjs` | Checks headers, file types, caching, that static files skip the Worker, all 900 PIN files, the URL guard and that private files aren't served. Takes `BASE_URL`. |

Pinned versions: Next.js 16.4.5, `@opennextjs/cloudflare` 1.20.16 (which needs Next.js 16.4.5 or newer) and `wrangler` 4.158.0.

**Local results:** **997 assets** would be uploaded: 998 files in `.open-next/assets` after OpenNext adds its 46 pre-rendered pages, minus `_headers`, which Wrangler parses but doesn't upload. That's 7.57 MB, with the largest file 316 KB, against the Free limits of 20,000 files and 25 MiB per file. Wrangler's "Read N files" message counts folders too, so it shows 1,045 (998 files and 47 folders). Worker upload 5,141 KiB, or 1,071 KiB compressed, from `wrangler deploy --dry-run`. All deployment and browser checks passed on the preview. These are local results, not Cloudflare measurements.

**Never cached:** `src/lib/cache-policy.ts` lists the private routes (`/bag`, `/checkout`, and the planned `/account`, `/order`, `/admin` and `/api`), and `next.config.ts` sends `Cache-Control: no-store` for them and everything under them. This overrides Next.js's default one-year `s-maxage` on pre-rendered pages, under both `next start` and OpenNext, while the page is still served from OpenNext's cache at no extra CPU. A unit test fails if any route in `src/app` isn't classified as public or private.

**Staging access: a password gate in the Worker (decided 7 November 2026).** Cloudflare Access was rejected: Zero Trust's Free checkout needs a card and a separate authorisation for usage charges, which the owner declined. Instead, `custom-worker.ts` checks a password before anything else runs (`src/lib/staging-gate.ts`):
- The browser shows its own username and password box (HTTP Basic authentication over HTTPS). Only the password is checked.
- The password is a Wrangler secret, `STAGING_PASSWORD`, set by the owner with `npx wrangler secret put`. It's never in code, Git or `wrangler.jsonc`. It's compared in constant time and removed from the request before Next.js sees it.
- **It fails closed:** a deployed Worker without a password of at least 20 characters refuses everything with 503. Only the plain-HTTP `localhost` preview skips the gate.
- **Limitation, accepted:** it protects everything the Worker serves (pages, in-app page loads, 404s), but static files are served before the Worker and stay reachable without the password: PIN data, build JavaScript, sample images, the favicon and `BUILD_ID`. None holds secrets or personal data. `/cdn-cgi/_next_cache/*`, which holds pre-rendered page HTML, returned 404 on Cloudflare, so it isn't reachable.
- The check scripts read the password from the macOS Keychain (`nevora-staging-password`) or `STAGING_PASSWORD`, and send it only to `https://nevora-store-staging.<account>.workers.dev` (`scripts/lib/staging-auth.mjs`).
- Deploy order: deploy 1 with `workers_dev: false`, so there's no address; set the secret; deploy 2 with `workers_dev: true`. Then `check-deploy` must see 401 on every Worker path before any other test.
- Production has no gate; it's removed in the approved production step.

**Known OpenNext difference:** a product URL with percent-encoded letters, such as `/products/sample-dome-jhumk%61`, returns 404 under OpenNext and 200 under `next start`. Browsers don't encode plain letters, so only hand-typed URLs are affected.

**PIN data versioning:** `PIN_DATA_VERSION` in `src/lib/pincode.ts` names the folder `public/data/pin/<version>/`. Browsers cache it for a year, so `scripts/build-pin-data.mjs` refuses to change an existing version and writes nothing; it only confirms a byte-identical rebuild. New data means a new version and a matching `public/_headers` rule, which a unit test checks. The old folder is deleted one release later.

**Verified on the staging Worker (7 November 2026, UTC), with the password gate on:**
- **Gate:** without the password, all 9 Worker paths tested and a wrong password returned 401, before Next.js ran.
- **Static files skip the Worker:** 48 static-file requests (PIN files with and without the password, the location file, a build file, images, the favicon, the notice, the manifest and `BUILD_ID`) produced **0 Worker invocations** in `wrangler tail`, while 10 page requests sent straight after produced exactly 10.
- **Headers and files on Cloudflare:** `check-deploy` passed **38/38**. That covers the security headers and `geolocation=(self)`, `no-store` on the bag, checkout and planned private routes, the year-long cache on build files and PIN data, all 900 PIN prefix files, file types, the URL guard, and private files not being served.
- **Browser checks over HTTPS:** **214/214** passed (address, including PIN auto-fill and "Use my current location", checkout, bag, pages, mobile and navigation), with 0 accessibility violations on 5 pages.
- **`/cdn-cgi/_next_cache/*`:** **404** on Cloudflare. Locally the preview served it, so this is a difference between the local preview and Cloudflare.
- **CPU, under the decision rule:** 6 routes (`/`, `/checkout`, `/bag`, a product page, a category page and the 404 page), each with 1,000 requests **paced** (one at a time, 200 ms apart) and 1,000 **sustained** (5 at a time): 12,000 in total. **All 12,000 got the expected response, with 0 CPU-limit kills.** `wrangler tail` sampled 26% of paced and 4% of sustained requests, with **0 `exceededCpu` events**. Normal pages used 1–3 ms (p50), with occasional successful spikes of 10–21 ms. The 404 page, which Next.js renders on demand, was the weak spot under sustained load: p95 95 ms and a maximum of 106 ms in the sample, with no kills. The run used about 12,500–12,700 Worker requests by the scripts' count, not Cloudflare's dashboard.
- **What this doesn't cover:** these are the current pre-rendered pages with sample data. Order saving, account and admin pages aren't built, and each needs the same 1,000-request run before launch. Workers Free is suitable for the current pages; it isn't yet established for future dynamic routes.

**`proxy.ts`, not `middleware.ts` (decided 5 November 2026).** Next.js 16 says `middleware.ts` "is deprecated and will be removed in a future version", and Supabase's guide is built around `proxy.ts`. OpenNext warns that its Node.js proxy support is experimental, though it's merging fixes for it. So `proxy.ts` only refreshes sessions and redirects, and every page and action checks the session and role itself. If `proxy.ts` proves unreliable on Workers, the fallback must be chosen then, with evidence.

## 4. The biggest risk: 10 ms of CPU

Workers Free allows **10 ms of CPU per request**, and Cloudflare's limits page says workloads that handle "authentication, server-side rendering, or parse large payloads typically use 10-20 ms". Going over returns Error 1102 to the customer. **A Next.js store could fail this limit even with very little traffic**, so this gets tested before any feature work.

### Compatibility test (Phase 1, on a free `workers.dev` address)

Build one small test app and deploy it with each adapter. It uses labelled sample data and has no shop features. A successful deploy isn't a pass: real storefront rendering and server-side routes must work, and CPU must be measured. Then check:

| Test | Pass condition |
|---|---|
| CPU per request, from Workers Logs | Under 10 ms on home, category and product pages and checkout, with no 1102 errors across a test run |
| Cold start | Within the 1 second startup limit |
| Worker size | Deploys on Free |
| Pages stored as static assets | Confirm which pages avoid running the Worker at all |
| Page caching and revalidation | Admin edit appears within the agreed time |
| Server actions and route handlers | Work, including errors |
| Login and `proxy.ts` | Supabase session cookies work and refresh correctly, and `proxy.ts` runs only on the protected paths |
| Database write from the Worker | A test Postgres function runs, and two competing requests for the last unit give exactly one success |
| Image upload | Presigned upload to R2 works. Needs R2 enabled, which may need a card, so it waits for the owner's approval. |
| Image display | A plain responsive `<img>` component serves pre-sized files |
| Email | Resend sends from the Worker |
| Metadata | Sitemap, metadata and error pages work |

### If the test fails

These are options for the owner, not automatic steps.

1. **Workers Paid, $5 a month (first choice, needs owner approval).** CPU rises to 30 seconds by default per request, and it includes 10 million requests a month. The budget in section 9 sets money aside for this, because it's a realistic outcome. The owner sees the results and estimated cost first, and nothing upgrades automatically.
2. **Static storefront.** Generate catalogue pages as static files, which are free and unlimited, with a small Worker for checkout and admin. It stays free, but needs rebuilds and adds complexity.
3. **Another paid host.** Last resort.

## 5. V1 checkout flow

1. The customer adds products to a cart stored in the browser. This needs no server requests.
2. At checkout they enter name, mobile, email and address, and see the final order summary and total.
3. The server validates the input and calls `create_order`. In one transaction it locks variants, checks stock, reads current prices, generates a unique order ID, saves the order and item snapshots, and holds stock. In the same transaction it queues the "order received" email. **The order is always saved before any WhatsApp link is offered.**
4. The customer sees the order page at a private link: **"Order placed, not yet confirmed"**, the summary, the exact amount, the configured UPI QR and ID, a reference form, optional proof upload, and an optional WhatsApp button. There's no automatic redirect, so nothing is lost if WhatsApp doesn't open.
5. The customer pays, then submits their UTR. **A reference is required to request verification, and a screenshot is optional.** WhatsApp isn't required if they can finish on the website.
6. Once the order is saved, the "order received" email queued in step 3 is sent. It says the order isn't confirmed yet, and a failed email doesn't affect the order.
7. The owner checks their **bank or UPI account**, using any reference or proof only as a clue. If the money has arrived, they record the amount and UTR from the bank record in `/admin`. They can also record a credit they find without any customer reference.
8. **Separately, the owner confirms the order.** If stock has gone, the money stays recorded, and the order is flagged for resolution or refund.
9. A "confirmed" email goes out. The owner arranges shipping manually, records courier and AWB, and a "shipped" email follows. **Unpaid orders can't be dispatched.**
10. The 2-hour window (provisional) holds stock. Orders with nothing submitted expire and their stock returns. A submitted reference stops automatic release, and the admin is alerted after 24 hours. Orders with money recorded never expire.

The full rules for stock, late payment, cancellation, returns, refunds and corrections are in `DATABASE_SCHEMA.md`.

**An order is never marked paid from a screenshot, a message, an uploaded proof, or anything else a customer submits.** A proof upload changes no status.

### What the application guarantees, and what needs configuration

| Capability | Guarantee | Needs |
|---|---|---|
| Dashboard alerts and held-stock list | Works from live data | Nothing external |
| Admin-run expiry sweep | One order per transaction, same guard, audited | Nothing external |
| Inline expiry on a late reference | In the same transaction | Nothing external |
| Automatic expiry | **Not claimed until configured and tested** | A scheduler, separately approved |
| Daily digest, target 09:00 IST (awaiting approval) | One row per date, no backfill for missed days | A scheduler and an email provider |
| Email | At-most-once, or at-least-once with a known duplicate risk. **No exactly-once claim.** | A provider and verified domain |

If the scheduler misses runs, the next run processes every due order. Customers aren't harmed, but stock stays held longer.

### Payment proof upload (plan)

Screenshots can be faked, so a proof is evidence for the admin and never a payment record.

- **Private storage only.** Proofs may show bank names, UPI IDs and amounts, so they stay separate from public product images, with no public URL or listing. **A private Supabase Storage bucket is evaluated first (owner decision, 6 Nov 2026).** R2 or any paid storage needs separate approval. The evaluation, before M5, must confirm that signed upload and view URLs meet the rules here, how much of the free storage and egress limits proofs would use, and how proofs are backed up, because the planned database export doesn't include Storage files.
- **Direct upload.** The browser compresses the image and uploads it using a signed URL for a server-generated key. Supabase signed upload URLs last 2 hours and can't be revoked individually, so the controls in `SECURITY_PLAN.md` assume one may leak. The Worker doesn't handle the file, which protects the CPU limit.
- **Access.** Only the relevant customer and authorised admins. Uploads need the order's private link or the owner's session. Admins view proofs through short-lived URLs after a server role check.
- **Limits.** Image types only, a size cap, a few uploads per order, and rate limits.
- **Retention and backup.** Provisional planning value: 90 days after order closure, subject to CA and legal review, with documented exceptions for disputes and legal obligations. **Automatic deletion isn't implemented yet.** Whether proofs are backed up off-site is undecided, pending `CA_LEGAL_REVIEW.md`.
- **Audit.** Each upload and admin view is logged, and proofs have no link to the payment ledger.

### Money rules

- **Before confirmation:** the full total verified in the bank or UPI account, zero refund liability, and no blocking flag.
- A customer can't see a payment as verified until the owner has confirmed the actual money received.
- Collected, Refunded and Refund liability are order-level ledger figures, not the bank balance. See `DATABASE_SCHEMA.md`.
- Partial credits are recorded and stay `verification_required`. They can never become an unpaid retry.
- Refunds are made outside the site, then recorded with a reference. A partial refund doesn't change payment status. A refund that bounces creates a new `due` record.
- UPI PINs, passwords and banking credentials are never stored anywhere. The UPI ID and QR are payment details shown to customers, and they come from admin settings through the server, not from frontend code or `NEXT_PUBLIC_` variables.
- **Risk of prepaid-only:** it could reduce orders from customers who prefer COD, and there's no data on how much. Every order also depends on the owner checking the bank promptly.

## 6. Launch features

**Storefront:** home, category pages, search, sort and filters, product page, cart, checkout, order page, and pages for contact, shipping, returns, privacy, terms and about.

**Admin:** login with mandatory MFA, order list and detail, customer references, private proof review, payment recording, separate confirmation, review flags, reinstatement, corrections, reconciliation views for references, UPI receipts, exceptions and refunds, a held-stock list, products with images and variants, categories and subcategories, stock, low-stock view, Trending Manager, settings (shipping, UPI, WhatsApp, windows), a simple sales summary and an audit view.

**Shipping, cancellation, returns and refunds:** the admin manually records courier, AWB, dispatch, delivery and returned parcels, and cancels eligible orders with stock returned. Customer returns can be full or partial, and leave the order `delivered`. `returned` applies only when a whole parcel never reached the customer. Refunds are made outside the site, then recorded with a reference, and can't exceed the amount received. Returned stock is added back only after inspection.

**Navigation (plan):** New Arrivals, Categories, Trending, Shop by Aesthetic, Festive Edit, Gift Box, More, read from the database. A section with nothing real in it stays hidden, and no empty or fake collections are created. Categories support subcategories.

**Shop by Aesthetic (lightweight, launch plan):** Korean Edit, Coquette Edit, Minimal Edit, Under ₹299 and Under ₹499, each included only if actual products support it. The edits use small `collections` and `collection_products` tables, and the price pages filter on the real price. The collection manager screen stays after launch.

**Honest merchandising:** real stock status, real end dates, and no ratings until real reviews exist. No invented sales, popularity or urgency claims.

**Customer accounts (optional):** signup with email verification, login, password reset and order history. Guest checkout never requires an account. Orders placed while logged in are linked to that account. Saved addresses and wishlist come later.

**Admin login:** a separate page at `/admin/login`. Being logged in as a customer gives no admin access. Every admin page, read and action needs the `admin` role, AAL2 and an active session, checked on the server and in the database.

**Cached pages and login:** public pages are cached, so they must be the same for everyone. Only `/account`, `/admin` and checkout read the session on the server. Session cookies are `HttpOnly`, so browser code can't read them. On public pages, the header gets the account state from a small non-sensitive flag or a same-origin session check, so logged-in customers don't disable caching.

**Server-only auth:** there's no Supabase browser client. Supabase describes `HttpOnly` as "not necessary", because a browser client must read these cookies. This design has none, so `HttpOnly` adds protection, but real session refresh must be retested on real Supabase. Adding a browser client later means removing `HttpOnly`.

**Supabase SSR isolation:** `@supabase/ssr` is pre-1.0 (0.12.7 on 6 Nov 2026), with no beta or stable label. Use exact versions with no `^`, and only `lib/supabase/` may import the Supabase packages. Upgrades are deliberate and rerun the tests. On Next.js 16 with `proxy.ts`, tests must prove that an expired token refreshes and the refreshed response is returned, that cache headers from `setAll` reach the response, that parallel requests during a refresh don't sign the user out, and that the proxy never runs on public pages.

**Not at launch:** see section 7 of `IMPLEMENTATION_ROADMAP.md`.

### Trending Now (plan)

**At launch, manual only.** The admin selects and orders products, assigns labels, activates and deactivates them, and can set optional dates. Labels are claims, so they must be true: "Editor's Pick" is always safe, while "Viral Pick" needs evidence. Unavailable products aren't shown as purchasable.

**Later, sales-ranked,** once enough real sales exist. Scores are pre-calculated by a scheduled database job, never at page load, and weights stay configurable. The proposed starting weights are: units sold in 7 days 40%, orders containing the product 25%, growth against the previous 7 days 20%, recent activity 15%.

An order counts only when all of these hold:

| Order | Counts when |
|---|---|
| UPI | **Payment has been verified** by the admin |
| COD, if added after launch | **Delivered, and courier collection is confirmed** |
| Any | Not cancelled, refunded, returned or a test order. **Placing an order never counts by itself.** |

Without enough data, the section shows manual picks or new arrivals, without calling them "trending" or "bestsellers". No popularity claims are invented.

### Campaigns (plan, after launch)

| Rule | Behaviour |
|---|---|
| Publication | **Manual only.** A campaign goes live only when the admin publishes it. |
| Start date | Informational. It never publishes a campaign. |
| End date | **Always stops campaign discounts automatically**, even if a page is cached |
| Deactivation | The admin can deactivate at any time |

The server works out every discount inside one pricing function, and browsers never send prices or discount amounts. Order items keep a snapshot of the list price, discount, final price and source campaign or coupon.

### Design system (plan)

| Colour | Contrast on ivory (calculated) | Use |
|---|---|---|
| Warm ivory `#F8F5EF` | | Backgrounds |
| Espresso `#34251F` | About 13.5:1 | Text, headings, buttons and interactive controls |
| Champagne gold `#C5A46D` | About 2.2:1 | **Decorative only** |
| Muted taupe `#B9A99A` | About 2.1:1 | **Decorative only** |

Text and interactive controls use accessible contrasting colours. Animation runs only where it adds meaning and respects reduced-motion. **Server-rendered content is never hidden until JavaScript runs,** because failed or slow scripts would then leave products invisible.

**M0 Motion measurement (local build, 6 Nov 2026):** using Motion for homepage section reveals added 38.4 KB of JavaScript to the home page (138.9 to 177.3 KB, +28%), and all four sections stayed invisible when scripts failed to load, or until they arrived when delayed. A CSS-only scroll reveal replaced it, with no added JavaScript and no such failure, so Motion was removed. Browsers without CSS scroll-driven animation show the sections without the fade. Motion could be reconsidered for a later interaction, such as a cart drawer, if measured on that route.

## 7. Keeping usage low

### Pages and data

- **Cache public catalogue data.** Use static or cached pages for home, categories and products. KV is off until real CPU has been measured and the owner approves it. OpenNext's docs don't recommend KV for its cache, so the method is chosen in Phase R. If it's enabled, use a long `revalidate`, such as one day, plus on-demand invalidation when the admin publishes a change: a 5-minute `revalidate` on about 20 pages could need 5,760 writes a day, against KV's free limit of 1,000.
- **Turn off link prefetching on listing pages.** Without this, each product card can trigger an extra Worker request.
- **Limit the session check to `/admin` and `/account`.** `proxy.ts` must not run on public storefront pages.
- **Show stock from cached data, and check it for real only in `create_order`.** If a cached price is out of date, the server's price wins and the customer sees the change before ordering.
- **Keep cart and checkout UI in the browser.** Call the server only when submitting.

### Images

- Product images live only in R2. The database stores keys and metadata, never image data, and Supabase Storage isn't used for them. Private payment proofs are covered in section 5. The UPI QR is stored as text in settings, so it isn't an R2 dependency, but product images still need the separate R2 decision.
- `sharp` can't run on Workers, so the **admin's browser** does the work on upload: it resizes to widths of 400, 800 and 1600px, converts to WebP and removes photo metadata. Targets are about 40, 120 and 250 KB (estimates).
- The server checks the admin, then issues a short-lived presigned upload URL for a key it generates.
- A plain responsive `<img>` component with `srcset` picks the right pre-made size, because vinext ignores `next/image` custom loaders. **Cloudflare Image Transformations aren't used.** Their free plan stops at 5,000 unique transformations a month, and new ones then return an error.
- Images are served from a custom domain such as `images.<domain>`, because `r2.dev` is rate-limited and "should only be used for development purposes". File names include a version, so they can be cached for a year.
- This requires the domain to be a Cloudflare zone in the same account as the bucket.

## 8. Free-tier limits and upgrade triggers

### Estimated load at 50,000 visits a month

Assumes 4 pages per visit, or 200,000 page views. These are planning estimates and will be replaced with measured numbers.

| Resource | Estimate | Limit | Reading |
|---|---|---|---|
| Worker requests, prefetch off (2 per page view) | 400,000 a month, about 13,000 a day | 100,000 a day | A day about 7.5 times the average hits the limit |
| Worker requests, prefetch left on (20 per page view) | About 133,000 a day | 100,000 a day | **Over the limit every day** |
| Supabase egress, uncached (20 KB per page view) | 4 GB a month | 5 GB | Too close |
| Supabase egress, 90% cached | 0.4 GB a month | 5 GB | Comfortable |
| R2 reads with no CDN cache (15 images per page view) | 3 million a month | 10 million | Fine, and lower once cached |
| R2 storage (60 photos in 3 sizes) | About 25 MB | 10 GB | Fine |

### Limits, behaviour and triggers

| Service | Free limit | What happens at the limit | Upgrade trigger |
|---|---|---|---|
| Workers requests | 100,000 a day, resets midnight UTC (5:30 am IST) | Error 1027. **The site is down until the reset.** | Over 50,000 on 3 days in a month, or over 70,000 on any day |
| Workers CPU | 10 ms per request | Error 1102 for that customer | Any repeating 1102 that optimisation doesn't fix |
| Workers logs | 200,000 events a day, kept 3 days | Check at setup | Rarely |
| Static assets | Requests free and unlimited; 20,000 files per version | | |
| R2 | 10 GB-month, 1M Class A, 10M Class B, egress free | **Docs list per-unit charges, so expect billing, not a stop.** A failed payment makes buckets return errors. | Over 70% of any allowance. Check caching first. |
| Supabase database | 500 MB | Notice, grace period, then possible restrictions | 350 MB |
| Supabase egress | 5 GB, plus 5 GB cached | Restrictions can include read-only mode, pausing or 402 errors. **Any of these stops orders.** | 3.5 GB in a cycle |
| Supabase pause | Pauses after low database activity over 7 days. Docs say "a few user requests to the database each day" is typically enough. A warning email comes about a week ahead. | Site can't reach data until resumed | Steady orders, and monthly contribution over ₹10,000 (proposed) |
| Supabase backups | No automatic backups on Free | Data loss risk. See `SECURITY_PLAN.md` for the recovery plan. | Pro is budgeted before public launch. Pro has daily backups kept 7 days, and our own export stays. |
| Supabase projects | 2 active projects. Paused projects don't count. | Test plus production uses both, so a real restore test needs the test project paused. | |
| Supabase file storage | 1 GB, and 50 MB per file | Proofs are capped by rate limits | |
| Supabase Auth email | Refuses non-team addresses without custom SMTP. About 30 messages an hour with custom SMTP. | Signup and reset emails fail or are limited. **Customer signup needs the domain and Resend.** | If signups hit the limit, raise it in settings |
| Resend | 100 a day, 3,000 a month, including received email. 10 requests a second. Verified domain required. | `429`, logged and retried. Daily limit resets midnight UTC. | 70 a day, or 2,100 a month |
| GitHub | Free for private repos | Check Actions minutes for backup jobs | Rarely |

At 3 emails per order, Resend's daily limit is reached at about 33 orders in a day.

### Monitoring and alerts

No service here offers everything the owner needs on a free plan:

| Service | Alerts available | Plan |
|---|---|---|
| Cloudflare | "Usage Based Billing" alerts need "Professional plans or higher". No hard spending cap was found in the docs. | Check the dashboard every week. Set up an alert if the account becomes eligible. |
| Supabase | Emails the billing address when over quota. Spend cap exists on Pro, on by default. | Check every week, and watch that inbox. |
| Resend | Notifies when over limits | Check every week. Also watch `notifications` failures in admin. |

Every Monday, the owner records Worker requests and errors, R2 usage, Supabase size and egress, and Resend volume. A small scheduled job can automate this later if the manual check proves tedious.

**Free isn't assumed suitable for a public production store.** With no automatic backups, up to 24 hours of orders could be lost even with our job. It can also pause, keep logs for only 1 day and has no point-in-time recovery. Free is for building and rehearsals. **Supabase Pro, from $25 a month, is budgeted before public launch, and buying it needs separate approval.**

Three limits can't cost money by themselves: Workers Free, Image Transformations and Supabase Free. R2 is the only service here that can bill without a plan change, and its charges for this usage would be small. Check the first invoice period closely.

## 9. Revised launch budget

| Line | Original | Previous proposal | **Now** |
|---|---|---|---|
| Inventory | ₹8,000 | ₹8,000 | ₹8,000 |
| Packaging and branding | ₹2,200 | ₹2,200 | ₹2,200 |
| Samples and freight | ₹1,200 | ₹1,200 | ₹1,200 |
| Photography and content | ₹1,300 | ₹1,300 | ₹1,300 |
| Marketing | ₹2,500 | ₹1,500 | ₹1,800 |
| Compliance and setup, excluding trademark filing | ₹3,000 | ₹1,200 | ₹1,200 |
| Dispatch and returns | ₹1,800 | ₹1,800 | ₹1,800 |
| Domain (estimate) | ₹0 | ₹1,000 | ₹1,000 |
| Hosting | ₹0 | ₹1,800 | ₹0 |
| Infrastructure contingency | ₹0 | ₹0 | ₹1,500 |
| Cash and reorder reserve | ₹5,000 | ₹5,000 | ₹5,000 |
| **Total** | **₹25,000** | **₹25,000** | **₹25,000** |

- **Infrastructure contingency:** about 3 months of Workers Paid at $5, assuming about ₹90 to the dollar. If the free tier passes the test, this money moves to stock reorders.
- **Expected monthly running cost:** ₹0 while building on free tiers. From public launch, plan on about ₹2,250 for Supabase Pro, plus about ₹450 if Workers Paid is needed, or ₹2,700 together, at about ₹90 to the dollar. That exceeds the ₹1,500 contingency within one month, and where the money comes from is an open decision. Nothing is purchased without separate approval. If Workers, Supabase and Resend all move to paid plans, it's about $50, or ₹4,500 a month.
- **Trademark filing** isn't in this budget. It's reported at ₹4,500 per class for individuals and small businesses. File from early profits, starting with Class 14.
- **Compliance at ₹1,200 needs review with the owner's CA.** It's a placeholder estimate, and it must not be assumed to cover all GST, Legal Metrology, privacy and legal expenses. If the CA's quote is higher, the difference needs a decision before other money is spent.

### Scale check

50,000 visits a month is a capacity target. It doesn't match the current sales plan of 30–50 orders from 130 units, and ₹1,800 of marketing won't buy that traffic. Even 0.5% of 50,000 visits is 250 orders, roughly twice the launch stock. Plan stock and cash around real conversion once it's measured.

## 10. Folder structure

The store goes in `store/`, a new folder. `deploy-test/` stays as it is.

```text
store/src/
  app/
    (store)/            home, categories, products, cart, checkout, order, policy pages
    (account)/          customer signup, login, password reset, /account
    admin/              separate login and protected dashboard
    api/                only where a server action won't do
  features/
    accounts/           customer auth and order history
    catalogue/          queries and components
    cart/               browser cart and components
    checkout/           validation and server action
    orders/             status rules, queries and admin actions
    payments/           ledger, reconciliation, proofs and display
    inventory/
    trending/           manual curation, later sales ranking
    fulfilment/         shipping, cancellation, refunds
    settings/
    media/              browser image processing and upload
  services/
    email/              Resend wrapper and templates
    whatsapp/           message and link builder
    upi/                UPI link builder
    storage/            R2 presigning and image URLs
  lib/
    supabase/           public and session clients, and the server-only service module
    money.ts            paise helpers and formatting
    auth.ts             requireAdmin(), with getUser(), role and AAL2 checks
    auth-cookies.ts     session cookie settings
  proxy.ts              /admin and /account only
  components/ui/
store/supabase/
  migrations/
  tests/                pgTAP tests
  post_restore.sql      recreates objects that dumps leave out
  enable_cron.sql       schedules jobs last, after a restore is verified
  seed.sql              dev-only sample data
store/tests/
  e2e/                  Playwright
  db/                   concurrency and restore tests
docs/
```

## 11. Tooling notes

- Next.js is at 16.x. Node here is 25.2.1, which isn't a long-term support release, so pin the app to Node 24.
- Run a pinned Supabase CLI through `npx supabase`. CLI v3 targets the local stack by default, so hosted commands need `--remote`. A bare `db push` in a job with a local stack succeeds against that stack, so check the target every time.
- Try the native local runtime first on Apple silicon. It's experimental, so validate it before relying on it. Docker Desktop needs separate approval.
- Create the project in **Mumbai (`ap-south-1`)**, which Supabase lists as an available region. Confirm it can be selected on the free plan. Use the publishable and secret keys, because legacy keys are being retired by the end of 2026.
- Check whether Cloudflare's checkout for R2 accepts your card before relying on R2. Its docs describe a checkout flow, and its billing policy asks for a valid payment method when enabling subscriptions.
