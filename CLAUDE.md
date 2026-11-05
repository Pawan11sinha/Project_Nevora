# NÉVORA store

Ecommerce site for NÉVORA, an Indian brand selling affordable artificial jewellery and hair accessories. One owner runs it from Delhi. Target launch: 1 December 2026.

Read before working on a feature:

- `docs/PROJECT_ARCHITECTURE.md`: system design, deployment, checkout, free-tier limits and budget
- `docs/DATABASE_SCHEMA.md`: tables, statuses and order and payment rules
- `docs/SECURITY_PLAN.md`: access rules, risks and go-live checks
- `docs/IMPLEMENTATION_ROADMAP.md`: phases, acceptance criteria and open decisions
- `novero_chat.md`: the original business plan, kept on the owner's computer only and never committed, because it holds personal and supplier details. Where it conflicts with `docs/`, `docs/` wins.

## Stack

Next.js App Router and TypeScript (strict), Tailwind, Cloudflare Workers, Supabase (Postgres and Auth), Cloudflare R2 for images, Resend, GitHub. Tests use Vitest and Playwright. Validation uses Zod.

The deployment adapter (OpenNext or vinext) is chosen by the Phase 1a test in `deploy-test/`. **vinext is beta, so don't use it in production without documented test evidence and the owner's explicit approval.** Vercel Hobby must not host the production store. Never upgrade to a paid plan automatically: show the owner the results and cost, then wait for approval.

## Scope

Build only the launch scope in the roadmap until launch has happened. It includes guest checkout, optional customer signup and login, and a separate protected admin login at `/admin/login`. These come after launch: saved addresses, wishlist, reviews, coupons, the AI assistant, Razorpay and automated WhatsApp messages. Keep the seams for them, but don't build them early.

## Cost rules

Stay on free tiers until a documented upgrade trigger is reached. Limits and triggers are in section 8 of the architecture doc. Workers Free allows only 10 ms of CPU per request and 100,000 requests a day.

- Cache public product and category data. Repeat catalogue views shouldn't query Supabase.
- Avoid unnecessary server requests. Turn off link prefetching on listing pages, keep cart UI in the browser, and don't run `proxy.ts` outside `/admin` and `/account`.
- Images live only in R2, never in the database or Supabase Storage. Resize and compress them in the admin's browser, and serve pre-made sizes through a plain responsive `<img>` component. Don't use `next/image` custom loaders, which vinext ignores, or Cloudflare Image Transformations.
- Stick to portable Next.js features. No PPR, `"use cache"` or native modules such as `sharp`.
- Use `proxy.ts`, not the deprecated `middleware.ts`. OpenNext flags Node.js proxy support as experimental, so `proxy.ts` only refreshes sessions and redirects. Pages and actions must check the session and role themselves.
- KV stays off until real Worker CPU has been measured and the owner has approved it.
- Ask before adding any paid service or plan.

## Rules that must not be broken

- The server calculates every price and total from the database. Never trust an amount from the browser.
- Store money as integer paise.
- Create orders and change stock only inside Postgres functions, in one transaction. Every stock change writes a `stock_movements` row.
- Order items keep a snapshot of name, SKU and price, so later catalogue edits never change old orders.
- **Never mark an order as paid from a screenshot, a message or any other customer claim.** Payment status changes only when an admin records money they've seen in the bank or UPI account, using `record_payment`.
- Keep the amount received separate from the remaining COD balance. The advance starts at ₹30, is deducted from the total, is configurable in admin, and each order keeps its own copy.
- Never store UPI PINs, passwords or banking credentials. UPI display details come from admin settings through the server, not frontend code.
- New accounts are always `customer`. Never read roles from `user_metadata`.
- All Supabase auth runs on the server, with `HttpOnly` session cookies. A Supabase browser client would need those cookies, so don't add one without changing `authCookieOptions` and retesting. Don't set a short `maxAge`.
- Payments, stock movements and audit logs are append-only. Correct mistakes with reversal rows. Every order and payment change is audit logged.
- RLS is on for every table. Admin checks run on the server and in the database, never only in the UI.
- Never expose secrets to browser code or put them in `NEXT_PUBLIC_` variables. Use `wrangler secret` in production and `.dev.vars` locally. Don't use `.env`, `.env.local` or `.env.production`, because OpenNext compiles them into the Worker bundle. Commit no `.env*` or `.dev.vars` files except `.env.example`.
- Never cache order, checkout or admin responses. Never log request bodies, addresses or phone numbers.
- A failed email must not fail an order. Log it in `notifications`.

## Content rules

- No fake reviews, ratings, sales counts, countdown timers or stock numbers.
- Don't claim waterproof, hypoallergenic, nickel-free, anti-tarnish, real silver or real gold unless the supplier has given evidence and the owner has approved it.
- Use reference sites (UnfoldSelf, GIVA, Palmonas) for shopping ideas only. Never copy their branding, assets, copy or layouts.
- Dev seed data must be labelled as sample data and must never reach production.

## Design

Warm and elegant, built for phones first. Avoid generic dashboard templates and heavy gradients.

| Colour | Hex | Use |
|---|---|---|
| Warm ivory | `#F8F5F0` | Page background |
| Espresso | `#46372F` | Logo, headings and primary buttons |
| Charcoal | `#2B2826` | Body text |
| Champagne gold | `#C9A96E` | Decoration only. Its contrast is too low for body text. |
| Champagne tint | `#E9DCCF` | Panels and cards |

Never use teal, which keeps NÉVORA distinct from UnfoldSelf. Use a serif for headings and a clean sans-serif for body text.

## How to work

- Build in small, reviewable steps and follow the roadmap's order.
- Keep code organised by feature, as set out in the architecture doc. Avoid adding dependencies without a clear need, because Worker size and CPU are limited.
- Schema changes go in versioned files under `supabase/migrations/`. Never edit an applied migration.
- Before calling work done, run `npm run typecheck`, `npm run lint` and `npm test`, and test the behaviour itself. For catalogue and checkout pages, check CPU on a deployed Worker. Report failures plainly.
- Ask before connecting an external service, spending money or touching production data.
