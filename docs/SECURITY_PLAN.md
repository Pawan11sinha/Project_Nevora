# NÉVORA security plan

Status: plan approved on 5 November 2026. Nothing is built until after Phase 1a.

## Access rules (Row Level Security)

RLS is on for every table. The default is no access. Storefront reads go through server code, so the browser doesn't need direct database access at launch. These rules still apply as a second layer.

| Data | Public | Admin | Server only |
|---|---|---|---|
| Active categories, products, image metadata | Read | Full | |
| Variants (without `cost_paise`) | Read, through a limited view | Full | |
| Orders and order items | Logged-in customers read only their own, without cost fields | Read, changes through functions | Create through `create_order` |
| Payments | None | Read, add through functions only | |
| Stock movements, audit logs | None | Read only | Written by functions and triggers |
| Notifications | None | Read | Write |
| Store settings | Only safe public fields, through a view | Through `update_store_settings` | |
| Profiles | Own row only, except `role` | Full | |
| Rate limits | None | None | Full |

Guests can see one order only, through its private link, using a server query that matches the long random token.

## Admin protection

- Customer signup is public, so it must never lead to admin access. New accounts always get the `customer` role, and the admin role is granted by hand with SQL. Never read roles from `user_metadata`, because users can edit it.
- Admin login is a separate page at `/admin/login`, and a logged-in customer who opens `/admin` gets no access.
- Every `/admin` page and action calls `requireAdmin()` on the server. Hiding a link is not protection.
- Database functions check `is_admin()` again, so a missed server check still fails.
- Use a strong unique password. Turn on MFA for the admin, Cloudflare, Supabase, GitHub, Resend and domain accounts.

## Payment integrity

- **Only an admin who has seen the money in the bank or UPI account can record a payment.** The form requires the amount, the source, and a UTR for UPI.
- Screenshots and customer claims change nothing, and no customer action can set payment status.
- `payment_status` and `amount_received_paise` change only through `record_payment` and `reverse_payment`.
- Payment rows and audit logs are append-only, even for admins. Mistakes are corrected with a reversal.
- A UTR can be used once.
- Advance and UPI setting changes are audit logged, and an email is sent to the owner.
- UPI PINs, passwords and banking credentials are never stored. The UPI ID and QR come from admin settings through the server, never from frontend code or `NEXT_PUBLIC_` variables.

## Secrets

| Value | Where it lives |
|---|---|
| Supabase secret key, Resend key, R2 access keys | `wrangler secret`, never in `wrangler` config files or code |
| Local values | `.dev.vars` and `.env.local`, both ignored by git |
| CI values | GitHub Actions secrets |
| Backup encryption key | Owner's password manager, plus a safe offline copy |

- No `NEXT_PUBLIC_` variable may hold a secret. Build output is checked for secret values before go-live.
- `lib/supabase/admin.ts` and `services/storage` import `server-only`, so using them in browser code fails the build.
- The R2 token can reach only the images bucket. Backups use a separate token for the backups bucket.
- Rotate any key that appears in a commit, log or chat.

## Image storage

- Two buckets: public `images`, served through a custom domain, and private `backups`, with no public access.
- `r2.dev` access stays off in production.
- Uploads use presigned URLs issued only after `requireAdmin()`. Each is valid for 5 minutes, for one server-generated key and content type.
- Bucket CORS allows `PUT` only from the site's admin origin.
- Only WebP files of an expected size are accepted, as checked by the admin upload flow. Photo metadata is removed in the browser.
- The QR code image is deliberately public. A change to it counts as a settings change and is audit logged.

## Main risks

| Risk | What could happen | Protection |
|---|---|---|
| Fake payment screenshot | Goods shipped without money received | See payment integrity above |
| Tampered prices | Customer edits the cart or request | Browser sends only variant IDs and quantities. Prices come from the database. |
| Edited WhatsApp message | Customer changes the amount in the text | Admin works from the order number and database |
| Overselling | Two customers buy the last unit | Row locks and a database check inside `create_order` |
| Fake orders holding stock | Someone ties up low-quantity SKUs | Hold expiry, limits per IP and phone, and on open unpaid orders per phone |
| Bots using up free limits | Daily 100,000 requests run out and the site goes down | Cloudflare bot and WAF rules run before the Worker where the free plan allows them. Crawl rules. Turnstile on checkout if abuse appears. |
| Surprise costs | R2 usage is billed and no hard cap was found | Admin-only uploads, CDN caching, weekly usage check. No Image Transformations. |
| Service suspended | A failed card makes R2 buckets return errors | Keep the payment method valid, watch the billing email |
| Account attacks | Password guessing or fake signups use up email limits | Supabase rate limits, a minimum password length, and Turnstile on signup if abuse appears. Login errors don't reveal whether an email exists. |
| Order link guessing | Someone reads another customer's address | Long random `public_token`, `noindex`, and a partly masked address |
| Changed UPI details | Payments go to someone else | Admin only, audit logged, email to owner |
| Email failure | Customer gets no message, or the order fails | Send after the order commits. Log quota errors, allow retry from admin. |
| Duplicate submission | Double tap creates two orders | Idempotency key, unique per order |
| Script injection | Stored text runs in the admin panel | React escaping, no raw HTML from users, Zod on all input, and security headers including CSP |
| Data loss | Supabase Free has no automatic backups | Daily encrypted backup, see below |
| Beta tooling fault | An adapter mishandles caching or auth | Compatibility test, private pages marked `no-store`, the real checks in Postgres |
| Private data cached | A cached page shows one customer's order to another | Order, checkout and admin responses are never cached, and a test proves it |

## Backups and recovery

Checked in Supabase's docs on 5 November 2026. They state no automatic backups for Free, and recommend free projects "regularly export their data using the Supabase CLI `db dump` command and maintain off-site backups".

**Backups**

- A daily GitHub Actions job exports roles, schema and data, encrypts them, and stores them in the private R2 `backups` bucket. It keeps 30 daily copies. Until R2 is enabled, no real customer data goes into the database.
- **The default dump skips the `auth` schema, which holds customer logins.** The job must export it explicitly, and a restore test must prove customers can still log in. Auth export steps need checking against Supabase's migration guide. The docs also conflict on dump flags (`--remote` or `--db-url`), so confirm with `db dump --help`.
- Images are in R2, so they aren't part of these dumps. Keep the original photos on the owner's computer as well.
- Backups hold customer data, so they're never stored unencrypted or as GitHub artifacts.
- Test one full restore into a new project before go-live, then repeat every 3 months.

**Inactivity pause**

- Supabase pauses Free projects with low database activity over 7 days. A few real database requests each day are typically enough to prevent this.
- The daily backup job also makes a real database query for this reason. It's helpful, not guaranteed.
- A warning email comes about a week before, and another once paused. Keep that inbox watched.

**If something goes wrong**

| Situation | Action |
|---|---|
| Project paused | Dashboard, Resume project. Restorable for up to 1 year. The docs give no restore time, so measure it in the test. Meanwhile, take orders by hand on WhatsApp. |
| Read-only or 402 restrictions | Lifted when the quota refills next billing cycle, or upgrade to Pro with owner approval |
| Data lost or corrupted | Create a new project, then restore the latest backup with `psql`, following Supabase's backup-restore guide. Update the secrets and redeploy. |
| Project deleted | Supabase backups go with it, so only the off-site copies remain |

**Note:** dumps need the Supabase CLI's container for `pg_dump`, or `pg_dump` directly. The Vault key can't be fetched from a paused project, so the store doesn't use Vault.

## Personal data

Customer names, phones and addresses are personal data, and the DPDP Rules are now in force.

- Collect only what's needed to fulfil the order, and explain why on the checkout form and privacy page.
- Keep marketing consent as a separate, unticked choice.
- Don't put addresses or phones in logs or analytics. Workers Logs are on by default, so never log request bodies.
- Avoid exporting customer data to personal chats or spreadsheets where possible. Limit what goes to the courier.

## Legal items to confirm with a CA or lawyer

- **Site details:** the Consumer Protection (E-Commerce) Rules 2020 require a grievance officer's name, contact details and designation to be displayed. Seller details and returns information also belong on the site. Reviewing these is the owner's task before launch, including whether a home address must be shown.
- **Compliance budget:** the ₹1,200 allocation is only a placeholder. Review it with the CA, and don't assume it covers all GST, Legal Metrology, privacy and legal expenses.
- **GST:** registration, and the rates and HSN codes for each product type. Margin calculations must deduct GST.
- **Small-business DPDP duties:** no clear source was found on phased dates or exemptions.
- **Personal UPI:** a business or merchant UPI ID is cleaner for accounts than a personal one.
- **Packaging:** Legal Metrology declarations on product packs.

## Before go-live checks

- [ ] RLS tests pass for anonymous, customer and admin roles
- [ ] A browser can't read `cost_paise`, orders, payments or unsafe settings
- [ ] A customer account can't open or call `/admin` actions, or raise its own role
- [ ] A customer can read only their own orders, and never cost fields
- [ ] A tampered price, quantity or variant is rejected or ignored
- [ ] Simultaneous orders for the last unit produce exactly one success
- [ ] No customer-supplied input can change payment status
- [ ] A UPI order can't be confirmed before full payment, and a COD order can't be confirmed before the advance
- [ ] Payment and audit rows can't be edited or deleted
- [ ] Order and admin responses are never cached
- [ ] Production bundle contains no secret values
- [ ] MFA is on for all service accounts
- [ ] Encrypted backup and restore tested, including customer logins
- [ ] `r2.dev` access is off, and CORS is limited
