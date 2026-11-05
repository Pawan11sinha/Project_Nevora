# NÉVORA architecture

Status: approved by the owner on 5 November 2026, for Phase 1a only. Later phases start after the deployment test results are reviewed. Vendor limits were read from official docs on that date, unless marked as an estimate. Recheck them before relying on them.

## 1. Confirmed decisions

| Area | Decision |
|---|---|
| Cost | Use free tiers wherever possible. Pay only when real usage requires it. |
| Capacity target | About 50,000 visits a month. This is an estimate, not a forecast. |
| Launch scope | Smaller shop for 1 December. Other features follow. |
| Range | Jewellery and hair accessories, as database categories |
| Frontend | Next.js and TypeScript |
| Hosting | Cloudflare Workers Free, subject to compatibility and production testing. Vercel Hobby won't be used for the production store, because Vercel limits it to non-commercial use. |
| Database | Supabase Free |
| Authentication | Guest checkout, plus optional customer signup and login with Supabase email and password. Admin login is separate, under `/admin`. |
| Paid hosting | Up to about $5 a month is acceptable if Cloudflare Free fails the test, but only after the owner sees the results and cost and approves. Never upgraded automatically. |
| Brand colours | Espresso, warm ivory, champagne gold and charcoal. No teal. |
| Product images | Cloudflare R2 free allowance |
| Email | Resend Free |
| Source control | GitHub Free |
| WhatsApp | Click-to-chat |
| Payment gateway | None at launch. UPI is checked by hand. |
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
Auth          auth email
```

- The browser doesn't talk to Supabase directly at launch. Public data goes through the cached server layer, which reduces database egress and exposure.
- Payment, email, WhatsApp and image storage each sit behind a small service module, so Razorpay or a different host can be added later without changing order logic.
- Scheduled database work, such as expiring unpaid orders, runs in Supabase with `pg_cron`, so it doesn't depend on the deployment adapter. Availability on the free plan is checked in Phase 1.

## 3. Deployment: vinext or OpenNext

Nothing is chosen until the test in section 4 has run.

| | vinext | OpenNext (`@opennextjs/cloudflare`) |
|---|---|---|
| Cloudflare's position | "Recommended as the default" for Next.js on Workers | Listed for existing OpenNext apps that can't yet migrate |
| Status | "vinext is in beta" in Cloudflare's guide. Its launch blog section says "Status: Experimental". Its README says use in production "with caution" because of "known compatibility gaps". | Not labelled beta on the pages read |
| What it is | A reimplementation of the Next.js API, so it isn't the real Next.js runtime | Adapter that runs the real Next.js build |
| Next.js support | Targets 16.x, about 94% of the API with full or partial support, by its own count | All Next.js 16 versions |
| Features with known gaps | `next/image` has no build-time optimisation. `"use cache"` and PPR are incomplete. Docs conflict on build-time static generation: the guide says supported, the blog says not yet. | Node middleware isn't supported. Edge runtime must be removed. |
| Size limit | Follows the Workers limit | OpenNext's page says 3 MiB compressed on Free. Cloudflare's newer limits page says 64 MiB uncompressed and no compressed limit. Confirm with a dry-run deploy. |

**Provisional choice: OpenNext for production, unless the test shows vinext is clearly better.** The store handles orders and customer data, and vinext's own docs warn about production use. The trade-off is that Cloudflare now points new projects at vinext, so OpenNext may get less attention from Cloudflare over time.

**Stay portable.** App code uses only ordinary Next.js features: no PPR, no `"use cache"`, no Node middleware and no native modules such as `sharp`. That keeps moving between adapters or hosts cheap.

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
| Image display | `next/image` custom loader serves pre-sized files |
| Email | Resend sends from the Worker |
| Metadata | Sitemap, metadata and error pages work |

### If the test fails

1. **Workers Paid, $5 a month (first choice, needs owner approval).** CPU rises to 30 seconds by default per request, and it includes 10 million requests a month. The budget in section 9 sets money aside for this, because it's a realistic outcome. The owner sees the results and estimated cost first, and nothing upgrades automatically.
2. **Static storefront.** Generate catalogue pages as static files, which are free and unlimited, with a small Worker for checkout and admin. It stays free, but needs rebuilds and adds complexity.
3. **Another paid host.** Last resort.

## 5. Revised checkout flow

1. The customer adds products to a cart stored in the browser. This needs no server requests.
2. At checkout they enter name, mobile, email and address, then choose **Pay by UPI** or **Cash on delivery**.
3. The server validates the input and calls `create_order`. In one transaction it locks variants, checks stock, reads current prices and the configured advance, generates a unique order ID, saves the order and item snapshots, and holds stock.
4. The customer sees the order page at a private link, with the order summary, the amount due now, the configured UPI QR and ID, and a **Send order on WhatsApp** button. There's no automatic redirect, so nothing is lost if WhatsApp doesn't open.
5. The customer pays the full total, or the COD advance, and presses the WhatsApp button.
6. An "order received" email goes out. It says the order isn't confirmed yet.
7. The owner checks their **bank or UPI account**. If the money has arrived, they record the amount and reference in `/admin`, then update the statuses.
8. A "confirmed" email goes out. Dispatch details and a "shipped" email follow.
9. Unpaid orders expire after the hold period and their stock returns. Orders with any money recorded are never expired automatically. They go to the owner for review.

**An order is never marked paid from a screenshot, a message, or anything else a customer submits.** The site has no customer-facing "I have paid" action that changes payment status.

### Money rules

| Method | Must be received before confirmation | Collected on delivery |
|---|---|---|
| UPI | Full total | Nothing |
| Cash on delivery | The configured advance | Total minus amount received |

- The advance is editable in the admin dashboard. It starts at ₹30 and is deducted from the order total.
- A customer can't see a payment as verified until the owner has confirmed the actual money received.
- UPI PINs, passwords and banking credentials are never stored anywhere. The UPI ID and QR are payment details shown to customers, and they come from admin settings through the server, not from frontend code or `NEXT_PUBLIC_` variables.
- Each order stores its own copy of the advance, so a later settings change doesn't affect it.
- The amount received and the remaining COD balance are separate values, and the balance is calculated. See `DATABASE_SCHEMA.md`.
- The advance filters out people who aren't serious. It won't cover a refused parcel, because courier charges both ways will probably be well above ₹30. Track refusals from day one.

## 6. Launch features

**Storefront:** home, category pages, search, sort and filters, product page, cart, checkout, order page, and pages for contact, shipping, returns, privacy, terms and about.

**Admin:** login, order list and detail with payment recording and status changes, products with images and variants, categories, stock, low-stock view, settings (shipping, advance, UPI, WhatsApp, hold time), a simple sales summary and an audit view.

**Customer accounts (optional):** signup with email verification, login, password reset and order history. Guest checkout never requires an account. Orders placed while logged in are linked to that account. Saved addresses and wishlist come later.

**Admin login:** a separate page at `/admin/login`. Being logged in as a customer gives no admin access, because every admin page and action checks the `admin` role on the server and in the database.

**Cached pages and login:** public pages are cached, so they must be the same for everyone. Only `/account`, `/admin` and checkout read the session on the server. On public pages, the header shows the account state from a small browser check, so logged-in customers don't disable caching.

**Not at launch:** see section 7 of `IMPLEMENTATION_ROADMAP.md`.

## 7. Keeping usage low

### Pages and data

- **Cache public catalogue data.** Use static or cached pages for home, categories and products, revalidating on a timer and when the admin publishes a change. Time-based revalidation is the safe default until the test confirms on-demand behaviour.
- **Turn off link prefetching on listing pages.** Without this, each product card can trigger an extra Worker request.
- **Limit the session check to `/admin` and `/account`.** `proxy.ts` must not run on public storefront pages.
- **Show stock from cached data, and check it for real only in `create_order`.** If a cached price is out of date, the server's price wins and the customer sees the change before ordering.
- **Keep cart and checkout UI in the browser.** Call the server only when submitting.

### Images

- Images live only in R2. The database stores keys and metadata, never image data, and Supabase Storage isn't used.
- `sharp` can't run on Workers, so the **admin's browser** does the work on upload: it resizes to widths of 400, 800 and 1600px, converts to WebP and removes photo metadata. Targets are about 40, 120 and 250 KB (estimates).
- The server checks the admin, then issues a short-lived presigned upload URL for a key it generates.
- A `next/image` custom loader picks the right pre-made size. **Cloudflare Image Transformations aren't used.** Their free plan stops at 5,000 unique transformations a month, and new ones then return an error.
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
| Supabase backups | No automatic backups on Free | Data loss risk. See `SECURITY_PLAN.md` for the recovery plan. | Same as above. Pro has daily backups kept 7 days. |
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
- **Expected monthly running cost:** ₹0 on free tiers. The likely first step is about ₹450. If Workers, Supabase and Resend all move to paid plans, it's about $50, or ₹4,500 a month.
- **Trademark filing** isn't in this budget. It's reported at ₹4,500 per class for individuals and small businesses. File from early profits, starting with Class 14.
- **Compliance at ₹1,200 needs review with the owner's CA.** It's a placeholder estimate, and it must not be assumed to cover all GST, Legal Metrology, privacy and legal expenses. If the CA's quote is higher, the difference needs a decision before other money is spent.

### Scale check

50,000 visits a month is a capacity target. It doesn't match the current sales plan of 30–50 orders from 130 units, and ₹1,800 of marketing won't buy that traffic. Even 0.5% of 50,000 visits is 250 orders, roughly twice the launch stock. Plan stock and cash around real conversion once it's measured.

## 10. Folder structure

```text
src/
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
    payments/           payment recording and display
    inventory/
    settings/
    media/              browser image processing and upload
  services/
    email/              Resend wrapper and templates
    whatsapp/           message and link builder
    upi/                UPI link builder
    storage/            R2 presigning and image URLs
  lib/
    supabase/           server and admin clients
    money.ts            paise helpers and formatting
    auth.ts             requireAdmin()
    image-loader.ts     next/image custom loader
  proxy.ts              /admin and /account only
  components/ui/
supabase/
  migrations/
  seed.sql              dev-only sample data
tests/
  e2e/                  Playwright
  db/                   RLS and order-function tests
docs/
```

## 11. Tooling notes

- Next.js is at 16.x. Node here is 25.2.1, which isn't a long-term support release, so pin the app to Node 24.
- Run the Supabase CLI through `npx supabase`. Create the project in **Mumbai (`ap-south-1`)**, which Supabase lists as an available region. Confirm it can be selected on the free plan.
- `create-next-app` can't scaffold into this folder directly, because it isn't empty and the name has capitals. Use a temporary sibling folder.
- Check whether Cloudflare's checkout for R2 accepts your card before relying on R2. Its docs describe a checkout flow, and its billing policy asks for a valid payment method when enabling subscriptions.
