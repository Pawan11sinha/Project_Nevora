# NÉVORA implementation roadmap

Status: product plan approved by the owner on 6 November 2026. **Approval covers the plan only.** Nothing here authorises SQL, Supabase schema changes, creating or deleting users or orders, Cloudflare changes, secret or environment changes, a GitHub push or a paid upgrade. Each of those, and the start of implementation, needs separate approval. Approving a phase or this plan authorises none of the actions in section 6.

**Target: public launch in the week of 11 January 2027.** The 1 December date is withdrawn. Payment security, inventory accuracy and checkout functionality won't be compromised to meet a date.

## 1. Launch scope

**In the first release:**

- Premium responsive storefront
- Product and category management
- Product listing, search, filters and product details
- Cart and checkout, with guest checkout and optional accounts
- **Prepaid manual UPI/QR workflow only**, with admin bank verification
- Customer references, with optional secure payment proof upload
- Customer authentication and order history
- Admin dashboard, with inventory and order management
- Manual shipping, and essential cancellation, return and refund handling
- Manually curated Trending Now
- Lightweight Shop by Aesthetic (Korean Edit, Coquette Edit, Minimal Edit, Under ₹299, Under ₹499), where actual products support each one

**Later:** COD and COD remittance reconciliation, payment gateways, automated verification and refunds, courier APIs and tracking, multi-order receipt allocation, advanced campaigns, sales-ranked trending, a reusable collection manager, homepage and banner managers, the AI shopping assistant, loyalty and advanced personalisation.

## 2. Timeline

All estimates are working days of building and review, on a five-day week, and have low confidence. The calendar assumes the upper estimates, approval to start on 9 November, and no blocking Stage 4 result. It excludes the owner's business tasks, listed in section 4. **M2 now takes much longer than these dates allow, as shown below. Dates from M2 onwards are re-baselined after Phase C, and the January target isn't confirmed either way.**

| Milestone | Delivers | Days | Target dates | Depends on |
|---|---|---|---|---|
| **M0. UI prototype** | Design system, key screens, Motion bundle measurement. Sample data, local only. | Built | Approved as a local prototype on 6 Nov, subject to the owner's browser and phone review. Not production-ready. | Doesn't touch `deploy-test/`, Supabase or Cloudflare. |
| **M1. Stage 4 complete** | The 10 ms decision on real routes, KV decision, final Cloudflare architecture | 1–2 | By 13 Nov | Approvals in section 6, owner's dashboard checks |
| **M2. Foundation** | Phases A to G below: real schema and RLS, tested functions, runtime decision, app integration, proven backups | 21–32 | To be re-baselined | See the phases below |
| **M3. Catalogue and admin** | Admin login, products, variants, categories, stock, image uploads | 4–5 | 19–25 Nov | M2, R2 decision, domain |
| **M4. Storefront** | Navigation, home, listing, search, filters, product pages, lightweight Shop by Aesthetic | 5–6 | 26 Nov–3 Dec | M0, M3 |
| **M5. Checkout, payments, accounts** | Cart, checkout, manual UPI/QR, references, payment proof, verification, accounts, emails | 6–8 | 4–15 Dec | M4, Resend, UPI details |
| **M6. Order operations** | Manual shipping, cancellation, refunds, returns, inventory reconciliation | 3–4 | 16–21 Dec | M5, courier choice, policies, lost-parcel policy |
| **M7. Manual trending and real catalogue** | Trending manager, real products and photos | 1–2 | 22–23 Dec | Stock and photos |
| **M8. Hardening** | Security checks, backup restore, CPU rule on real routes, accessibility, SEO | 4–5 | 24–30 Dec | M5–M7 |
| **M9. Private pilot** | A small group places real prepaid orders, including refunds, a return and an undelivered parcel | 3–5 | 31 Dec–6 Jan | M8, GST and legal review |
| **Buffer** | Fixes from the pilot, and year-end delays | 2+ | 7–8 Jan | |
| **Public launch** | | | **Week of 11 Jan 2027** | All above, plus owner's go-ahead |

**Total:** to be recalculated after Phase C. The earlier total of 29–40 working days assumed 2–3 days for M2.

### M2 phases

Each phase needs its own approval.

| Phase | Work | Depends on | Days | External? |
|---|---|---|---|---|
| **A. Docs** | Record the V1 design in the six plan docs | Owner's approval | Done, 7 Nov | No |
| **B. Tools** | Pinned Supabase CLI, validate the native runtime | A | 1 | Installs only |
| **C1. Lock and ledger foundation** | Local migrations for 20 of the 30 tables (listed in `DATABASE_SCHEMA.md`): roles, grants, the lock helper, guards, version triggers, `create_order`, `record_verified_payment`, and tests. Delivered as C1a, C1b and C1c, each approved separately. | B | 3–5 | No |
| **C2. Remaining schema and security** | The other 10 tables, including `shipments` and `returns`, plus `refunds.return_id` and the `return` refund origin, and the remaining functions and tests, run locally. Hosted Auth and role tests need separate approval. | C1. Hosted tests also need Stage 4 done and a project decided. | 6–9 | Hosted tests only |
| **Stage 4** (M1) | The owner's separate SQL and deployment approvals | Owner's approvals | 1–2 | Yes |
| **R. Runtime assessment** | `vinext check`, then both adapters in a throwaway copy outside `store/`, with real routes and auth | C, Stage 4 tooling | 3–5 | Deployment parts need approval |
| **D. App integration** | Pinned clients, auth helpers and validation in `store/`, with the UI and sample data unchanged | **Runtime decision and passing C** | 3–4 | Adds packages |
| **E. Production project** | Confirm the plan, create the project and apply approved migrations, with no real data | D, owner's approval | 1 | **Yes** |
| **F. Backups** | GitHub, storage location, job and restore test | E, approvals | 2–3 | **Yes** |
| **G. Real data gate** | Go-live checks, rebuild production empty | All above, CA answers | 1–2 | **Yes** |

Phase B stops if validation fails: the runtime must start, Auth, Storage, `pg_cron`, `test db` and `db dump --local` must work, and Postgres must match the hosted version. Docker Desktop needs separate approval.

**Local runtime status (7 November 2026):** Phase B pinned Supabase CLI 3.0.0 in `store/`, and every CLI command goes through `npm run -s supabase`. All validation ran on this Mac without Docker, on disposable stacks outside `store/`, and nothing hosted was touched. **Phase B isn't closed, because the hosted PostgreSQL version comparison is pending (local is 17.11). C1 hasn't started, and needs separate approval.**

| Stage | Scope | Result |
|---|---|---|
| **Level 1** | Native start, service health, `pg_isready`, Auth and Storage health endpoints | Passed once. Its cache check can't rule out a time-zone data download by Analytics. |
| **Partial Level 2** | Storage, Auth and persistence, with Analytics on | Storage passed. AU5, AU5c and the network check failed, and the cache check is treated as failed. See the issue record. |
| **Corrected Level 2** | Same tests with corrections, Analytics excluded, two runs from empty | Passed, including Confirm email, TOTP to AAL2, and AAL2 surviving a refresh. No outbound connections sampled. |
| **CR1–CR3, `pg_cron`** | Create the extension, schedule `select 1`, unschedule | Passed: one run succeeded, with no later runs in 70 seconds |
| **TD1–TD2, `test db`** | One passing file, and one deliberately failing file | Passed: the failing file was correctly reported, with exit 1 |
| **DP1–DP2, dump and restore** | Dump, then restore a one-row marker schema into a separate database | Passed, for the marker schema only |
| **MG1, migrations** | One throwaway table: `migration up`, then `db reset` | Passed: table rebuilt, marker row gone, history correct |

**What these results don't prove:**
- These were simple tool checks, not tests of the NÉVORA schema, the three-role design or any payment rule.
- DP2 isn't a backup or restore proof. It didn't cover Auth, Storage or a whole database, and restore on the hosted platform stays with Phase F.
- Nothing here shows a match with hosted Supabase, or production readiness.
- The tests used a throwaway config with Confirm email and TOTP on. `store/supabase/config.toml` still has both off and Analytics on, and any change there needs approval.

**Issue status:** DEF-2 and DEF-5 are closed. DEF-4 is closed with a qualification: Analytics was excluded, and its traffic was never directly captured. DEF-3's corrected findings are kept. **DEF-6 is open:** after refresh-token reuse is detected, the newest token still worked immediately, and an older access token still passed `getUser()`. It must be resolved before real customer or admin sessions. Full history and evidence are in `docs/test-evidence/LEVEL2_ISSUES.md`.

**Storage `0.0.0` diagnostic (explained):** `/storage/v1/version` returned `0.0.0` in every run, while the CLI resolved Storage as `v1.88.0`. Storage's code reports its `VERSION` variable or falls back to `0.0.0`, and the running process had no such variable. Upload, access, signed-URL, limit and deletion tests all passed. The endpoint can't confirm the version, so the `v1.88.0` identity rests on the lock file and cache path.

Phase R exists to break a circular dependency: Phase D waits for the runtime decision, but that decision needs real routes and Supabase auth.

**Gate before real customer data:** Stage 4 passed, runtime chosen, restore proven on the hosted platform, go-live security checks ticked, production rebuilt empty, MFA on, CA answers received, and the owner's explicit go-ahead.

Migrations are versioned. A migration counts as **applied** once it's committed to Git or has run on any database that isn't a disposable local stack. After that it's never edited, and changes go in a new migration. Before that, a draft may be edited. Locally, rebuild from empty. Before real data, reset production and reapply. With real data, back up first and apply a forward fix, correcting append-only rows only with reversals. Production migrations never run automatically: the owner sees the exact file and fingerprint, and approves it. Seed data stays local.

**After launch, in order, based on real results:**

| Milestone | Delivers | Days |
|---|---|---|
| M10 | Reusable collection manager and homepage and banner managers | 4–6 |
| M11 | Campaigns, discounts and coupons, aiming to finish before Valentine's Day 2027 | 5–7 |
| M12 | Sales-ranked trending, once enough real sales exist | 3–4 |
| M13 onwards | Verified reviews, saved addresses, wishlist, Razorpay, automated WhatsApp, AI assistant, loyalty, personalisation | Not estimated |

### What could move the dates

| Risk | Effect |
|---|---|
| **Stage 4 fails the 10 ms rule** | Needs route changes or Workers Paid at about $5 a month, with approval. Could add days, and changes M2 onwards. |
| **KV test fails, or is unsuitable** | Admin changes need another refresh method. Could add days to M3 and M4. |
| **R2 needs a card that isn't accepted** | Blocks product images |
| **Trademark isn't clear** | Delays the domain and packaging, which delays email and images |
| **Late stock, photos, GST or legal review** | Moves M7 and M9 directly |
| **Hosted platform blocks the Auth backup** | Real customer data stays blocked until the owner chooses an alternative |
| **Native runtime fails validation** | Phase C waits for a decision on Docker Desktop or another option |
| **Hosted Supabase blocks the three-role design** | A fallback with weaker claims is needed |
| **Actual bank QR doesn't parse or validate** | QR design changes, and customers may need a different path |
| **No scheduler is approved** | No automatic expiry or digest, so stock stays held until the admin runs a sweep |
| **Slow review rounds** | These estimates assume approvals within about a day |

## 3. Acceptance criteria

**M0. UI prototype**
- Works at 360px and desktop, with no sideways scrolling and no layout shift.
- Text and controls meet contrast requirements. Gold and taupe are decorative only.
- Reduced-motion is respected, and Motion's real client bundle impact is measured and reported **before it's used widely**. Result in `PROJECT_ARCHITECTURE.md` section 6.
- No real data, no Supabase, no deployment. Sample data is labelled.

**M1. Stage 4**
- Zero `exceededCpu` kills across at least 1,000 fully captured requests per critical route, using real Supabase calls. Incomplete capture is inconclusive.
- Exactly 4 users, 16 orders and a ₹199 product with 1 unit afterwards.
- Temporary secrets and test routes are removed.

**M2. Foundation**
- `typecheck`, `lint`, `test` and `build` pass, and migrations rebuild from empty.
- Tests prove RLS, that `create_order` ignores browser prices and can't oversell, and that status moves and append-only tables are enforced.
- A backup, including Auth users, identities and MFA factors, is restored successfully on the hosted platform.

Phase C must include these tests. **None has been executed.** Hosted tests need separate approval.

- **Auth export and restoration against the actual hosted Supabase version,** covering `auth.users`, `auth.identities` and `auth.mfa_factors`. Phase C can't be signed off until it passes.
- **Hosted feasibility:** roles and ownership, membership, definer `current_user`, child-trigger `current_user`, API-role denial, `search_path` safety, `lock_owner` `FOR UPDATE` with its column grant and RLS, stamp visibility, and stamp clearing on restore.
- **Write lock:** `create_order`'s `NULL`-then-helper sequence, direct stamp by `ledger_owner` and API roles, child write without a stamp or with another order's stamp, forged settings, `NV102`, savepoints, version triggers, overlapping orders, opposite-direction wrong-order, and sweep against `create_order`. **Deadlock freedom isn't claimed.**
- **Null `order_id`:** refused on every child table. On `stock_movements`, allowed only for `adjustment` and `purchase`.
- **Privileges:** every function as each API role, the table and column matrix regenerated from the real catalogue, and catalogue checks with no false positives for `postgres`, catching deliberately wrong grants.
- **Simultaneous admin confirmation and order expiry:** exactly one result, and stock moves once.
- **Corrections:** each reason code and kind, replacement rules, duplicate correction prevention, UTR generation, and original rows unchanged.
- **Wrong-order:** every source and target status, forced failure at each step leaving both orders unchanged, both versions rising atomically, and refusal with a completed, partial or unrecovered refund.
- **Every status pair** for orders, payments, refunds, returns, submissions and flags: allowed pairs pass, and all others fail, including direct SQL and privileged calls. Reinstating a cancelled order always fails.
- **Allowed pairs:** every disallowed payment and order pair fails at commit.
- **Derived status:** all worked accounting examples, from ledger totals.
- **Flags:** each of the 15 against retry, confirm, process, reinstate, dispatch, expiry and closure. One resolution never resolves another. Recurrence under concurrency.
- **Retry:** a partial credit never reaches `failed` or `pending_payment`. First failure gets exactly 2 hours, and a second gets no window.
- **Deadlines:** timestamps write-once, grace fixed after flag resolution, extension refused over the cap and after a second failure.
- **Reinstatement:** separate from confirmation, refused with `late_payment` open or liability above 0, and two reinstatements for the last unit give exactly one success.
- **Late references:** each case in `DATABASE_SCHEMA.md`, and a late reference can't hold stock.
- **Closed orders:** status unchanged on reopening, flags opened, and normal checks required again.
- **Cancellation guard:** refused when financial or submission state changed, including under concurrent credits, reversals and refunds.
- **Stock match:** a variant's stock change that doesn't equal that transaction's stock movements is refused at commit.
- **Ledger match:** cached totals or a stored `payment_status` that don't match the ledger are refused at commit.
- **Refusal evidence:** an expected refusal returns a result and its `audit_logs` row survives. An unexpected failure rolls back and is recorded by `record_refused_attempt` in a separate transaction. If that also fails, it's logged and reported as lost evidence.
- **Admin sessions:** tests must show that a role-removed, factor-removed or banned admin, and a signed-out session, are denied on the next request even with an unexpired token, through `getUser()` and `require_admin_session()`. Only the signed-out case has evidence so far: locally, an access token was refused by `getUser()` after sign-out (Level 2, AU6). The role, factor and ban checks are untested until these tests pass. `aal1` admins see only the MFA page, and access is denied if Auth is unreachable. **Refresh-token reuse is a separate, open case (DEF-6):** locally, after Supabase detected reuse, the newest refresh token still worked immediately afterwards, and an access token issued before detection still passed `getUser()`. This sequence is tested and its result recorded. No immediate revocation is claimed for it unless a test demonstrates it, and reuse detected only inside Supabase stays a residual risk until the access token expires.
- **Secret key:** table reads are denied and admin functions are refused.
- **Notifications:** one digest row per date, one claim, and `delivery_unknown` not resent automatically. Exactly one queued `order_received` row per committed order, none after an idempotent retry, and none when the order rolls back.
- **Payment proofs:** the database-level parts of the required list in `SECURITY_PLAN.md`, and `proof_access_log` same-order keys. Storage tests need a Storage environment and run before M5 at the latest.

**C1 acceptance:** migrations rebuild from empty, catalogue checks pass and catch wrong grants, the write-lock and null-order tests pass, API roles can't write or call internals, `create_order` can't oversell and ignores tampered prices, `record_verified_payment` refuses customers and the secret key, `paid` never confirms, forced failures leave everything unchanged, and concurrency tests reconcile. Local results make no hosted compatibility claim.

**M3. Catalogue and admin**
- Admin adds products, variants, photos and categories without code changes. Subcategories work.
- Non-admins can't reach any admin page, action or upload URL.
- Empty categories stay hidden on the storefront.

**M4. Storefront**
- All product data, prices, stock and categories come from the database.
- Search and filters work on real data, and their CPU is measured.
- Repeat catalogue views don't query Supabase, and pages show no invented ratings, counts or urgency.

**M5. Checkout, payments, accounts**
- Manual UPI works from cart to confirmed on real Android and iPhone devices.
- **Nothing a customer submits, including a payment proof, can mark an order as paid.**
- Proofs are private: unguessable, unlisted, reachable only by the uploader's order and admins, and size and type limited.
- An order can't be confirmed without verified full payment and zero refund liability, and recording money never confirms by itself.
- Customers see "Order placed, not yet confirmed" until confirmation.
- Collected, Refunded and Refund liability stay correct through part payments, refunds, reversals and corrections.
- Orders with nothing submitted expire after the window and stock returns. Orders with a reference, a flag or money received don't expire automatically.
- WhatsApp links contain none of the excluded fields, and the order exists before the link is offered.
- Signup, verification, login, reset and own order history work. A customer can't reach `/admin`.
- Emails pass SPF and DKIM. A failed email doesn't fail an order.

**M6. Order operations**
- Admin records dispatch and tracking. Stock returns correctly on cancellation, and only after inspection on a return.
- Refunds are recorded with a reference, and can't exceed the amount received.
- Customer returns and RTO parcels stay separate, and stock returns only after inspection.
- Admin reconciliation views match the ledger.
- Lost-parcel policy is defined.
- Every change appears in the audit log.

**M7. Manual trending and real catalogue**
- Admin selects, orders, labels, activates and deactivates products, with optional dates, and changes appear within the agreed time.
- Unavailable products aren't shown as purchasable.
- Labels are honest, and no sales or popularity numbers are shown.

**M8. Hardening**
- All `SECURITY_PLAN.md` go-live checks are ticked.
- **Zero `exceededCpu` kills on the real routes:** logged-in `/account`, `/admin`, order page, checkout, search and proof upload.
- Accessibility and SEO basics are checked, and limits are measured against the free-tier table.

**M9. Private pilot**
- Real prepaid orders complete through a real courier, including at least one cancellation, refund, return and undelivered parcel.
- Stock and money reconcile exactly with the audit log.

## 4. Business work alongside the build

These dates are dependencies for the milestones above. Their current status isn't known to this document.

| Before | Task | Why |
|---|---|---|
| M3 | Search IP India for NÉVORA, NEVORA and similar-sounding names in Classes 14, 26 and 35. Check the Instagram handle and domain. | Must clear before printing or buying the domain |
| M3 | Buy the domain if checks are clear, and point its nameservers to Cloudflare | R2 images and Resend both need it |
| Before G | Take `CA_LEGAL_REVIEW.md` to a CA or lawyer, and start GST registration if advised. Review the ₹1,200 compliance placeholder. | Tax and retention rules depend on it, and it doesn't cover all GST, Legal Metrology, privacy and legal costs |
| M5 | Business UPI account and QR, and a WhatsApp business number. Check the actual QR format against the specification. | Needed for the payment flow, and QR rules stay a draft until then |
| M6 | Courier quotes for prepaid shipping and returns | Sets the shipping charge and real margins |
| M6 | Cancellation, refund and return policies, reviewed by your CA or lawyer | Needed for customer terms |
| M7 | Supplier quotes, samples, stock, packaging and product photos | Real catalogue |
| M9 | Seller details, grievance officer details, and a test dispatch | Legal pages, and finding problems before customers do |

Marketplaces come after the site works, and only where real fees give acceptable margin.

## 5. Pricing rule

Before any price is published, calculate per channel: selling price, minus GST, product cost, packaging, platform and shipping cost, and returns reserve.

The original plan's Meesho prices fail this test using its own ₹85 fee allowance:

| SKU | Price | Buy | Left per order, before GST |
|---|---|---|---|
| Jhumkas | ₹199 | ₹65 | ₹22 |
| Large claw clip | ₹149 | ₹35 | ₹2 |
| Pearl studs | ₹149 | ₹45 | -₹8 |
| Bow clips | ₹129 | ₹28 | -₹11 |

Check the allowance against Meesho's actual charges. Until then, sell items under ₹199 only in bundles there.

## 6. Open decisions and approvals

| # | Item | Recommendation | Needed by |
|---|---|---|---|
| 2 | Four load-test SQL changes from the audit, as local edits | Approve | Before M1 |
| 3 | Run the load function, and prove its rollback | Approve after item 2 | M1 |
| 4 | Deploy the gated app, upload secrets, measure, roll back | Approve one at a time | M1 |
| 5 | Runtime (vinext or OpenNext) and plan. Any paid plan needs explicit approval. | Undecided. Decide from Phase R results. | After Phase R |
| 6 | Whether to enable KV | Decide after an isolated test | After M1 |
| 7 | Confirm payment proof storage after evaluating a private Supabase Storage bucket, and choose backup Option A or B | **Undecided, pending CA and legal review.** R2 or paid storage needs separate approval. | Before M5 |
| 8 | Enable R2, if its checkout needs a card | Decide when the checkout is seen | Before M3 |
| 9 | Confirm how long payment proofs are kept | Provisionally 90 days after an order closes, subject to CA and legal review, with documented exceptions for disputes and legal obligations. No automatic deletion yet. | Before M5 |
| 11 | UPI account | Business or merchant UPI, if your bank offers it easily | M5 |
| 12 | WhatsApp business number | A dedicated number | M5 |
| 13 | Shipping charge and courier | ₹49 flat, free above ₹499, revised after courier quotes | M6 |
| 14 | Cancellation, return and refund policy | Replacement for damaged items, with an unboxing video requested | M6 |
| 15 | Threshold for sales-ranked trending | At least 50 qualifying orders over at least 4 weeks | M12 |
| 16 | Which project the hosted Auth test uses, and how `auth.mfa_factors` gets synthetic data | Decide before that test. Needs a temporary project, or the test project paused. | Phase C |
| 17 | Which Supabase project Phase R's deployed tests use | Decide before Phase R, because `store/` has no database yet | Before Phase R |
| 18 | Where the Supabase Pro budget comes from | Budgeted before launch, but it exceeds the ₹1,500 contingency within one month | Before public launch |
| 20 | Indefinite operational stock holds, with no automatic release | **Awaiting owner approval.** Recommended, accepting tied-up stock. | Before M5 |
| 21 | Admin cancellation while an operational flag stays open | **Awaiting owner approval.** Recommended. | Before M5 |
| 22 | Daily manual review duty on held stock | **Awaiting owner approval.** Recommended. | Before M5 |
| 23 | 24-hour amber and 72-hour red warnings | **Awaiting owner approval.** Recommended. | Before M5 |
| 24 | 24-hour grace and 72-hour deadline cap | **Awaiting owner approval.** Recommended, provisionally. | Before M5 |
| 25 | Daily digest target of 09:00 IST | **Awaiting owner approval.** Recommended, provisionally. | When a scheduler exists |
| 26 | `entry_corrected` on wrong-order targets | **Awaiting owner approval.** Recommended. | Phase C |
| 27 | A reference within the window stops automatic release until the admin acts | **Awaiting owner confirmation.** Recommended to keep. | Phase C |
| 28 | `overpayment` doesn't block reinstatement | **Awaiting owner approval.** Recommended. | Phase C |
| 29 | Refuse wrong-order with an unrecovered refund, using the manual path | **Awaiting owner approval.** Recommended. | Phase C |
| 30 | How to treat a target customer who paid while correction is refused | **Owner's business decision,** with CA input | Before M5 |
| 31 | Recovery transfers stay manual, and whether a `refund_recovered` kind is needed | **Awaiting owner and CA decision** | Before M5 |
| 32 | Lost-parcel policy | Define before the shipping phase. Starting proposal in `DATABASE_SCHEMA.md`. | Before M6 |
| 33 | Single-admin attestation limit on corrections | **Awaiting owner acceptance** | Before M5 |
| 34 | Scheduler choice, and email provider idempotency | Unverified, each separately approved | Before relying on them |
| 35 | Finding 11: `refunds` lacks `updated_at` (though Privileges grants an update on it), `returned_at`, `voided_at` and a cancellation reason column | **Open.** Proposed: add the four columns and matching grants | Before C1c |
| 36 | Finding 12: which customer refusals, such as `create_order` stock or limit refusals, need audit rows, and how they're rate-limited. The core refusal-evidence rule is in `DATABASE_SCHEMA.md`, but this remaining scope was never fully defined. | **Open, scope undefined.** Proposed: log customer refusals only through rate-limited `record_refused_attempt` | Before C1b |
| 37 | Finding 15: no claim or result functions for the notification sender | **Open.** Proposed: two named functions, with no direct table rights for `service_role` | Before C2 or M5 |
| 38 | Finding 17: views aren't specified as `security_invoker`, and customer views don't explicitly exclude `public_token`, idempotency fields and stamps | **Open.** Proposed: every view `security_invoker = true`, with an explicit exclusion list | Before C1b |
| 39 | Finding 19: statement-check attestation is explicit only for reversals, not for `entered_in_error` on every kind | **Open.** Proposed: require it for every kind | Before C2 |
| 40 | Finding 20: "submission closed" can also mean the reference limit was reached, which could wrongly trigger the inline-expiry row | **Open.** Proposed: check the limit first | Before C2 |
| 41 | Finding 21: opening conditions for `overpayment` and `old_submission` are undefined | **Open.** Proposed: `overpayment` opens when A − B − C exceeds the total; `old_submission` opens from the sweep or a review action | `overpayment` before C1c, `old_submission` before C2 |
| 42 | Finding 22: no enforcement stated for shipment moves, return quantity limits, customer returns needing `delivered`, and RTO needing a shipment | **Open.** Proposed: add them to the trigger inventory | Before C2 |
| 43 | Smaller schema items: primary keys for `rate_limits` and `collection_products`, a stored reason for rejected submissions, the hard-coded 72-hour grace cap, enum values listed in one place, and `amount_mismatch` wording for wrong-order targets | **Open**, to settle during implementation | Before C2 |

Items 35–43 are findings from the 6 November schema audit, recorded here on 7 November. Recording them doesn't resolve them.

**These each need separate explicit approval, whatever else has been approved:** any paid service, upgrade or card use; creating a Supabase project; R2 setup or buckets; any deployment, including test deployments; SQL on any hosted database, including Stage 4 SQL; secrets, external settings, DNS or the domain; a GitHub remote, push or Actions; installing tools, including the Supabase CLI, native runtime and Docker Desktop; and creating real users, orders or payments.

**Decided:**

| Date | Decision |
|---|---|
| 5 Nov 2026 | Revised budget as a working plan. About $5 a month acceptable, subject to approval. Guest checkout plus optional accounts. ₹30 configurable COD advance, deducted from the total. **COD replaced on 7 Nov, below.** |
| 5 Nov 2026 | Strict CPU rule: zero `exceededCpu` kills across at least 1,000 requests per critical route, using real Supabase calls |
| 6 Nov 2026 | Smaller launch scope, in section 1. Separate `store/` folder, with `deploy-test/` preserved. Separate real Supabase project. |
| 6 Nov 2026 | Campaigns are manually published. Start date is informational. End date stops discounts automatically. Admin can deactivate at any time. |
| 6 Nov 2026 | Manual trending at launch, and sales ranking later, under the rules in `PROJECT_ARCHITECTURE.md` |
| 6 Nov 2026 | New palette, and Motion for React, used selectively after measuring its bundle impact |
| 6 Nov 2026 | M0 approved: local UI prototype with sample data only |
| 6 Nov 2026 | Payment proofs: evaluate a private Supabase Storage bucket first, separate from public images, with no public URLs and access only for the relevant customer and authorised admins. No R2 or paid storage without separate approval. |
| 6 Nov 2026 | Lightweight Shop by Aesthetic is in the launch plan, where actual products support it, using `collections` and `collection_products` |
| 6 Nov 2026 | Full COD by default, replacing the ₹30 advance. **Replaced on 7 Nov: no COD in V1.** Design kept for later. |
| 6 Nov 2026 | COD fee ₹0 initially. **Replaced on 7 Nov: no COD in V1.** |
| 6 Nov 2026 | 12-hour hold. **Replaced: one 2-hour provisional website reservation.** |
| 6 Nov 2026 | COD refunds wait for the courier remittance. **Replaced on 7 Nov: no COD in V1.** Kept for later review. |
| 6 Nov 2026 | Phase R, restricted secret-key access and the reconciliation ledger, each subject to implementation and security tests |
| 6 Nov 2026 | Mandatory TOTP MFA for admins, with AAL2 and active-session checks on every admin page, read and action |
| 6 Nov 2026 | Product images stay in R2, with no buckets, configuration or cost yet |
| 6 Nov 2026 | Native local runtime tried first on Apple silicon. No Docker Desktop without separate approval. |
| 6 Nov 2026 | Payment proof backup Options A and B undecided, pending CA and legal review |
| 6 Nov 2026 | Supabase Pro budgeted before public launch. No purchase or upgrade without separate approval. |
| 6 Nov 2026 | Phases A to C may run alongside Stage 4, locally only. Phase D waits for the runtime decision and passing local security tests. |
| 7 Nov 2026 | **Prepaid manual UPI only in V1.** No COD or payment gateway. |
| 7 Nov 2026 | Null-order stock movements allowed only for `purchase` and `adjustment` |
| 7 Nov 2026 | Zero outstanding refund liability before confirmation, processing and dispatch |
| 7 Nov 2026 | `late_payment` resolved before reinstating an expired order |
| 7 Nov 2026 | Three-role write-lock architecture as the working design, subject to actual PostgreSQL testing |
| 7 Nov 2026 | Customer payment claims stay separate from independently verified bank receipts |
| 7 Nov 2026 | Payment recording stays separate from order confirmation |
| 7 Nov 2026 | After Level 1: the repo-root `.vscode/` stays untouched, and out of commits unless explicitly approved later. `supabase.lock` is kept and reviewed during C1. Empty stack folders and cache leftovers stay untouched. |
| 7 Nov 2026 | `~/.supabase/ports.sqlite` is an accepted exception, as machine-level Supabase CLI port-registry state outside `store/`, and it's kept |
| 7 Nov 2026 | DEF-2 and DEF-5 closed. DEF-4 closed with the qualification that Analytics was excluded and its traffic not directly captured. DEF-6 stays open. |
| 7 Nov 2026 | `order_review_flags` as table 30, with independent flag lifecycles. Immutable corrections. Genuine bank reversals never erased. No silent write-off after a reversal. One UPI transaction per order. Cancelled orders never reinstated. |
| 7 Nov 2026 | Build split: C1 creates 20 of the 30 tables, including `notifications` in C1b; C2 creates the other 10, including `shipments` and `returns`. DEF-6's two proposed tables are a separate future approval, outside the 30. |
| 7 Nov 2026 | `notifications` isn't covered by the order write lock. Its writes stay restricted to `ledger_owner` and named functions, and `dedupe_key` prevents duplicates. |
| 7 Nov 2026 | `create_order` queues the `order_received` notification inside its own transaction, and order creation triggers it |
| 7 Nov 2026 | Finding 18: explicit `ON DELETE RESTRICT` keys, no `DELETE` or `TRUNCATE` for application roles, and role separation. No trigger is claimed to stop the owner or a database administrator. |
| 7 Nov 2026 | A migration counts as applied once it's committed to Git or has run on any non-disposable database |

## 7. Stage 4 status

The disposable test project and `deploy-test/` remain in place. Results so far are in `CLOUDFLARE_COMPATIBILITY_REPORT.md`, which doesn't yet include Stage 3 or the latest findings. Stage 4 must be complete before production deployment and the final Cloudflare architecture decision. Visual design, frontend planning and non-production UI prototyping can proceed independently, with `deploy-test/` untouched.

## 8. After launch, in more detail

1. Reusable collection manager, homepage and banner managers
2. Campaigns, discounts and coupons, using the manual publication rules
3. Sales-ranked trending, using only qualifying orders
4. Verified-purchase reviews with moderation, then saved addresses, a cart that follows the account, wishlist, and linking past guest orders to a verified email
5. COD, with COD remittance reconciliation, and Razorpay
6. WhatsApp Business Platform for order updates and consented abandoned-cart messages, plus mobile OTP after checking TRAI/DLT rules
7. Courier integration and tracking, automated refunds, and marketplace sync
8. AI shopping assistant, once the catalogue is big enough to need one. It reads real prices and stock through server tools, and never invents prices, stock, discounts or policies. Usage is billed separately from a Claude subscription.
9. Loyalty and advanced personalisation
