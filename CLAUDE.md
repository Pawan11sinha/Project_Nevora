# NÉVORA store

Ecommerce site for NÉVORA, an Indian brand for premium jewellery and Gen-Z trending accessories, starting with artificial jewellery and hair accessories. One owner runs it from Delhi. Target: public launch in the week of 11 January 2027. Payment security, inventory accuracy and checkout are never compromised to meet a date.

Read before working on a feature:

- `docs/PROJECT_ARCHITECTURE.md`: system design, deployment, checkout, free-tier limits and budget
- `docs/DATABASE_SCHEMA.md`: tables, statuses and order and payment rules
- `docs/SECURITY_PLAN.md`: access rules, risks and go-live checks
- `docs/IMPLEMENTATION_ROADMAP.md`: phases, acceptance criteria and open decisions
- `docs/CA_LEGAL_REVIEW.md`: tax, retention and policy questions awaiting a CA or lawyer
- `novero_chat.md`: the original business plan, kept on the owner's computer only and never committed, because it holds personal and supplier details. Where it conflicts with `docs/`, `docs/` wins.

## Stack

Next.js App Router and TypeScript (strict), Tailwind, Cloudflare Workers, Supabase (Postgres and Auth), Cloudflare R2 for images, Resend, GitHub. Tests use Vitest and Playwright. Validation uses Zod.

The store will live in `store/`, using a separate real Supabase project. `deploy-test/` and the test Supabase project are for testing only, and stay untouched unless a step explicitly covers them. Motion for React isn't installed, and may be used only where measurement justifies it.

The deployment runtime (OpenNext or vinext) is undecided, and is chosen after Phase R tests the actual NÉVORA routes with Supabase authentication. **vinext is beta, so don't use it in production without documented test evidence and the owner's explicit approval.** Vercel Hobby must not host the production store. Never upgrade to a paid plan automatically: show the owner the results and cost, then wait for approval.

## Scope

Build only the launch scope in the roadmap until launch has happened. It includes guest checkout, optional customer signup and login, and a separate protected admin login at `/admin/login`. **V1 is prepaid manual UPI only.** It also includes manual trending, customer payment references with optional proof upload, and manual shipping, cancellation, return and refund handling. It includes lightweight Shop by Aesthetic pages (Korean, Coquette and Minimal Edits, Under ₹299, Under ₹499) where actual products support them. These come after launch: COD, payment gateways, courier APIs, automated verification and refunds, multi-order receipt allocation, campaigns, coupons, sales-ranked trending, the reusable collection manager, homepage and banner managers, saved addresses, wishlist, reviews, the AI assistant, loyalty, personalisation, Razorpay and automated WhatsApp messages. Keep the seams for them, but don't build them early.

## Cost rules

Stay on free tiers until a documented upgrade trigger is reached. Limits and triggers are in section 8 of the architecture doc. Workers Free allows only 10 ms of CPU per request and 100,000 requests a day.

- Cache public product and category data. Repeat catalogue views shouldn't query Supabase.
- Avoid unnecessary server requests. Turn off link prefetching on listing pages, keep cart UI in the browser, and don't run `proxy.ts` outside `/admin` and `/account`.
- Product images live only in R2, never in the database or Supabase Storage. Payment proofs stay private and separate: a private Supabase Storage bucket is evaluated first, and R2 or paid storage for them needs separate approval. Resize and compress them in the admin's browser, and serve pre-made sizes through a plain responsive `<img>` component. Don't use `next/image` custom loaders, which vinext ignores, or Cloudflare Image Transformations.
- Stick to portable Next.js features. No PPR, `"use cache"` or native modules such as `sharp`.
- Use `proxy.ts`, not the deprecated `middleware.ts`. OpenNext flags Node.js proxy support as experimental, so `proxy.ts` only refreshes sessions and redirects. Pages and actions must check the session and role themselves.
- KV stays off until real Worker CPU has been measured and the owner has approved it.
- Ask before adding any paid service or plan.

## Rules that must not be broken

- The server calculates every price and total from the database. Never trust an amount from the browser.
- Store money as integer paise.
- Create orders and change stock only inside Postgres functions, in one transaction. Every stock change writes a `stock_movements` row.
- Order items keep a snapshot of name, SKU, price and tax, and orders keep an address snapshot, so later edits never change old orders.
- **Never mark an order as paid from a screenshot, a message, an uploaded proof or any other customer claim.** Payment proofs are private evidence for the admin only. Money is recorded only when an admin with AAL2 has seen it in the bank or UPI account, through the ledger functions. Customer references are claims, kept separate from verified receipts, and never create a receipt or set `paid`.
- Payment status is derived from ledger totals, never from the previous status. Recording money and confirming an order are separate operations: `paid` never automatically means `confirmed`.
- One verified UPI transaction belongs to one order, and a UTR can't be recorded as two receipts.
- Confirmation, processing and dispatch need `paid`, zero refund liability and no blocking flag. A partial verified credit can never become an unpaid retry.
- Order status changes are enforced in the database, accounting events never move an order backward, and cancelled orders can never be reinstated. Expired orders are reinstated only deliberately, with `late_payment` resolved first. Customers must see "placed" and "confirmed" as different states.
- Every open review flag blocks automatic expiry and stock release. Flags resolve one at a time. Clearing `closed_at` is a financial reopening, never an operational one.
- Genuine bank movements are never corrected or erased. Corrections are immutable and only for data-entry mistakes. There's no silent write-off: a loss after a reversal stays under review until a CA-approved treatment exists.
- Never store UPI PINs, passwords or banking credentials. UPI display details come from admin settings through the server, not frontend code.
- New accounts are always `customer`. Never read roles from `user_metadata`.
- Every admin page, read and action needs mandatory TOTP MFA at AAL2 and an active-session check, on the server (`getUser()`) and in the database. Locally verified claims alone aren't enough for admin.
- The Supabase secret key is never used for normal admin actions, and only named server-only operations may use it.
- The three-role write-lock design in `docs/DATABASE_SCHEMA.md` is the working design, subject to actual PostgreSQL testing. Don't describe proposed SQL or unexecuted tests as verified or production-ready, and don't claim deadlock freedom. Only `adjustment` and `purchase` stock movements may have a null `order_id`.
- Pin exact Supabase package versions, imported only from `lib/supabase/`.
- All Supabase auth runs on the server, with `HttpOnly` session cookies. A Supabase browser client would need those cookies, so don't add one without changing `authCookieOptions` and retesting. Don't set a short `maxAge`.
- Payment receipts and events, stock movements, status history and audit logs are append-only. Correct mistakes with reversal rows. Every order and payment change is audit logged.
- RLS is on for every table. Admin checks run on the server and in the database, never only in the UI.
- Never expose secrets to browser code or put them in `NEXT_PUBLIC_` variables. Use `wrangler secret` in production and `.dev.vars` locally. Don't use `.env`, `.env.local` or `.env.production`, because OpenNext compiles them into the Worker bundle. Commit no `.env*` or `.dev.vars` files except `.env.example`.
- Never cache order, checkout or admin responses. Never log request bodies, addresses or phone numbers.
- A failed email must not fail an order. Log it in `notifications`. Don't claim exactly-once email or automatic expiry until a scheduler and provider are configured and tested.

## Content rules

- No fake reviews, ratings, sales counts, countdown timers or stock numbers. Trending labels must be true, and sales-ranked trending counts only verified payments. If COD is added after launch, it counts only delivered orders with courier collection confirmed.
- Campaigns publish manually only. Start dates never publish them, and end dates always stop their discounts.
- Don't claim waterproof, hypoallergenic, nickel-free, anti-tarnish, real silver or real gold unless the supplier has given evidence and the owner has approved it.
- Use reference sites (UnfoldSelf, GIVA, Palmonas) for shopping ideas only. Never copy their branding, assets, copy or layouts.
- Dev seed data must be labelled as sample data and must never reach production.

## Design

Warm and elegant, built for phones first. Avoid generic dashboard templates and heavy gradients.

| Colour | Hex | Use |
|---|---|---|
| Warm ivory | `#F8F5EF` | Backgrounds |
| Espresso | `#34251F` | Text, headings, logo, buttons and interactive controls |
| Champagne gold | `#C5A46D` | Decoration only. Its contrast is too low for text or controls. |
| Muted taupe | `#B9A99A` | Decoration only. Its contrast is too low for text or controls. |

Never use teal, which keeps NÉVORA distinct from UnfoldSelf. Use an elegant editorial serif for headings and a modern sans-serif for body text. Animations must respect reduced-motion and avoid layout shifts, and server-rendered content must never stay hidden until JavaScript runs.

## How to work

- Build in small, reviewable steps and follow the roadmap's order.
- Keep code organised by feature, as set out in the architecture doc. Avoid adding dependencies without a clear need, because Worker size and CPU are limited.
- Schema changes go in versioned files under `store/supabase/migrations/`. Never edit an applied migration, meaning one committed to Git or run on any non-disposable database. A draft run only on disposable local stacks may be edited.
- Before calling work done, run `npm run typecheck`, `npm run lint` and `npm test`, and test the behaviour itself. For catalogue and checkout pages, check CPU on a deployed Worker. Report failures plainly.
- Ask before connecting an external service, spending money or touching production data.
