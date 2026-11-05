# NÉVORA implementation roadmap

Status: approved on 5 November 2026, for Phase 1a only. Dates are targets for a 1 December launch.

## 1. Build phases

| Phase | Dates | Delivers | Needs from owner |
|---|---|---|---|
| 1a. Deployment test | 5–7 Nov | Small test app in `deploy-test/` on `workers.dev` with both adapters, a written result and a recommended choice. No domain needed. | Cloudflare account, Supabase test project in Mumbai |
| **Decision gate** | **7 Nov** | **Owner sees results and estimated cost, then picks the adapter and plan** | Approval |
| 1b. Foundation | 7–9 Nov | App scaffold, launch schema, RLS, order and payment function tests, backup job | |
| 2. Storefront | 9–13 Nov | Home, category, product, cart and policy pages, with caching in place and labelled sample data | Approve the look |
| 3. Admin catalogue | 11–15 Nov | Admin login, products, categories, stock, and image processing with R2 upload | Domain on Cloudflare, R2 enabled |
| 4. Checkout and orders | 14–19 Nov | Checkout, order page, UPI instructions, WhatsApp button, payment recording, status changes, configurable advance, hold expiry, audit view | WhatsApp number, UPI details, QR |
| 5. Email and customer accounts | 17–22 Nov | Received, confirmed and shipped emails with logs and retry. Customer signup, verification, login, password reset and order history. | Domain DNS access |
| 6. Real catalogue | 19–24 Nov | Real products, prices, stock and photos in a production database | Photos, final prices, descriptions |
| 7. Hardening and go-live | 24–29 Nov | Security checks, tests, load test, usage dashboards, SEO basics, production deployment, real test orders | Policy text, seller details |
| **Launch** | **1 Dec** | | |

Local development and the deployment test don't depend on the domain. R2 production images, sending email and real customer signup do.

Adding customer accounts makes the schedule tighter. If time runs short, cut in this order: sales summary, filters beyond category and price, search, then release customer accounts just after launch with the owner's approval, since guest checkout works without them. Never cut stock safety, payment recording, audit logs or backups.

## 2. Acceptance criteria

**Phase 1a**
- Every test in section 4 of `PROJECT_ARCHITECTURE.md` has a recorded result for each adapter, including CPU per request on real storefront pages and a server-side route. A successful deploy alone doesn't count.
- Tests that couldn't run, such as those needing R2, are listed as not tested.
- The comparison covers beta status, Next.js feature compatibility and free-tier CPU.
- Supabase recovery is checked: pause and resume, and a backup and restore including `auth`, as far as a test project allows.
- The result names the adapter, the plan needed and its monthly cost. The owner approves before any paid plan is used.
- If vinext is recommended, its risks and test evidence are written down, and the owner approves it explicitly.

**Phase 1b**
- `typecheck`, `lint`, `test` and `build` pass, and the first commit is made.
- Migrations rebuild the database from empty.
- Tests prove the access table in `SECURITY_PLAN.md`.
- Tests prove `create_order` ignores browser prices and can't oversell.
- Tests prove status moves, the payment rule and append-only tables are enforced.
- A backup runs and is restored successfully.

**Phase 2**
- A customer can browse and fill a cart on a 360px phone screen, with no sideways scrolling.
- A new category added in the database appears without code changes.
- Listing pages make no prefetch requests, and `proxy.ts` doesn't run on them.
- Repeat views of catalogue pages don't query Supabase.
- Measured CPU stays within the chosen plan's limit.
- Pages show no invented ratings, sales counts or claims.

**Phase 3**
- Admin can add a product with photos and variants without touching code.
- Uploads produce three WebP sizes in R2, with metadata removed and no image data in the database.
- Images load from the custom domain with long-lived cache headers.
- Non-admins can't reach any admin page, action or upload URL.

**Phase 4**
- UPI and COD orders work from cart to `confirmed` on real Android and iPhone devices.
- The order page shows a unique order ID, the summary and the configured UPI details.
- The WhatsApp button opens the right number with the order number, items and total.
- A COD order can't be confirmed without the advance, and a UPI order can't be confirmed without full payment.
- Changing the advance in admin affects new orders only.
- The amount received and the remaining COD balance show separately and stay correct through part payments and reversals.
- Every payment and status change appears in the audit view.
- Nothing a customer does can mark an order as paid.
- Orders with nothing received expire and stock returns. Orders with money received don't expire.

**Phase 5**
- Emails reach Gmail inboxes from the NÉVORA domain, with SPF and DKIM passing.
- With email deliberately broken, orders still save and the failure appears in admin.
- Guest checkout works without an account, and also works while logged in.
- A customer can sign up, verify, log in, reset their password and see only their own orders.
- A customer account can't reach `/admin`, and public pages stay cached for logged-in customers.

**Phase 7**
- All `SECURITY_PLAN.md` go-live checks are ticked.
- A load test simulating the estimated busy-day traffic stays within limits, with measured numbers replacing the estimates in the architecture doc.
- The owner has done one weekly usage check from the list.
- At least one real UPI and one real COD test order have been sent through a courier to a real address.

## 3. Business work alongside the build

| By | Task | Why then |
|---|---|---|
| 8 Nov | Search IP India for NÉVORA, NEVORA and similar-sounding names in Classes 14, 26 and 35. Check Instagram handle and domain. | Must clear before printing or buying the domain |
| 8 Nov | Speak to a CA and start GST registration. Review the ₹1,200 compliance allocation, covering GST, Legal Metrology, privacy and legal costs. | Marketplace listings depend on it, and the allocation is only a placeholder |
| 8 Nov | Contact suppliers and get written quotes | Real costs replace the targets in the plan |
| 9–13 Nov | Visit Sadar Bazaar and Chandni Chowk, inspect samples | Final 12 SKUs |
| 10 Nov | Buy domain if checks are clear, and point its nameservers to Cloudflare | R2 images and Resend both need it |
| 13 Nov | Get courier quotes, including COD fees and return charges | Sets shipping charge and real margins |
| 14–18 Nov | Buy stock, order packaging | Use the espresso and ivory palette |
| 19–23 Nov | Photograph products with real samples, create reels | Needed for Phase 6 |
| 28 Nov | Test dispatch | Finds packaging problems before customers do |

Marketplaces come after the site works, and only where real fees give acceptable margin.

## 4. Pricing rule

Before any price is published, calculate per channel: selling price, minus GST, product cost, packaging, platform and shipping cost, and returns reserve.

The chat's Meesho prices fail this test using its own ₹85 fee allowance:

| SKU | Price | Buy | Left per order, before GST |
|---|---|---|---|
| Jhumkas | ₹199 | ₹65 | ₹22 |
| Large claw clip | ₹149 | ₹35 | ₹2 |
| Pearl studs | ₹149 | ₹45 | -₹8 |
| Bow clips | ₹129 | ₹28 | -₹11 |

Check the allowance against Meesho's actual charges. Until then, sell items under ₹199 only in bundles there.

## 5. Open decisions

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| 1 | Adapter and plan. Any paid plan needs explicit approval after seeing results and cost. | Decide from test results. Provisionally OpenNext. | 7 Nov |
| 2 | Enable R2, if its checkout needs a card | Decide when the checkout is seen | Before the R2 test |
| 3 | Compliance budget after the CA's review | Review with CA | By 8 Nov |
| 4 | Unpaid order hold time | 12 hours | Phase 4 |
| 5 | WhatsApp business number | A dedicated number, usable later on the WhatsApp Business Platform | Phase 4 |
| 6 | UPI account | Business or merchant UPI, if your bank offers it easily | Phase 4 |
| 7 | Shipping charge | ₹49 flat, free above ₹499, revised after courier quotes | Phase 4 |
| 8 | Courier | Compare a courier aggregator with direct courier and India Post | 13 Nov |
| 9 | Return and refund policy | Replacement for damaged items, with an unboxing video requested. Confirm with your CA. | Phase 7 |

Decided on 5 November 2026: revised budget as a working plan, about $5 a month acceptable subject to approval, guest checkout plus optional customer accounts, brand colours without teal, and a ₹30 configurable COD advance deducted from the total.

## 6. Phase 1a location

The test apps live in `deploy-test/`, separate from the future store, and hold no real customer data. Their setup and results are in `deploy-test/README.md` and `deploy-test/RESULTS.md`. They deploy to free `workers.dev` addresses and are deleted after the decision, along with the test Supabase project.

## 7. After launch

Order based on what real orders and customers show. Suggested order:

1. Saved addresses, a cart that follows the account, wishlist, and linking past guest orders to a verified email
2. Verified-purchase reviews with moderation
3. Coupons, banners, collections and gifting edits, in time for Valentine's Day 2027
4. AI shopping assistant, once the catalogue is big enough to need one. It reads real prices and stock through server tools, and never invents prices, stock, discounts or policies. Usage is billed separately from a Claude subscription.
5. Razorpay
6. WhatsApp Business Platform for order updates and consented abandoned-cart messages, plus mobile OTP after checking TRAI/DLT rules
7. Courier integration and marketplace sync
