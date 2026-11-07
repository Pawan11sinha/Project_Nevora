# NÉVORA security plan

Status: V1 design, updated on 7 November 2026. **Nothing here is built, and no test has been executed.** Every control is subject to implementation and security tests, and nothing here is verified or production-ready.

## Access rules (Row Level Security)

RLS is on for every table. The default is no access. Storefront reads go through server code, so the browser doesn't need direct database access at launch. These rules still apply as a second layer.

| Data | Public | Customer | Admin with AAL2 | Secret key |
|---|---|---|---|---|
| Active catalogue | Read through views, no cost, in-stock yes or no only | Same | Full, no direct stock edits | Not used |
| Orders and order items | None | Own only, without cost fields | Read, changes through functions | `create_order` and token lookup only |
| Payment receipts and events | None | None | Read, add through functions only | **None** |
| Customer references | None | Own order, through the server | Read and review | `submit_payment_reference` only |
| Review flags | None | None, derived wording only | Read, open and resolve through functions | **None** |
| Refunds, shipments, returns | None | Own through limited views | Through functions | None |
| Proof records | None | None directly, own order through the server | Read and review | Signed URLs only |
| Stock movements, audit logs, status history | None | None | Read only | Written by functions and triggers |
| Notifications | None | None | Read | Through named functions only, with no direct table rights |
| Store settings | Only safe public fields, through a view | Same | Through `update_store_settings` | Not used |
| Profiles | None | Own row: read, update `full_name` and `phone`, never `role` | Read. `role` is granted by hand with SQL, never through the app. | Signup trigger only |
| Rate limits | None | None | None | Through `rate_limit_hit` |

An automated test lists every table and function that guests, customers and the secret key can reach, and fails on anything not on an approved list.

Guests can see one order only, through its private link, using a server query that matches the long random token.

## Access paths

| | Customer session | Admin session | Secret key |
|---|---|---|---|
| **Identity** | Their login | Their login with AAL2 | The server, never a person |
| **Used for** | Own profile and orders | **All normal admin actions** | Checkout, guest order link, customer references, proof URL signing, notifications |
| **Protected by** | RLS, limited views | `requireAdmin()`, `require_admin_session()`, restrictive RLS | Named functions in one `server-only` file |

**Narrowing the secret key.** It must never be used for normal admin actions or reach browser code.

1. `service_role` bypasses RLS but not grants, so it gets **no table grants**, only `EXECUTE` on the named functions.
2. Admin functions refuse it: it has no execute rights on them, and they fail without a real user.
3. The module exposes named methods only, with no general query client.
4. An import-boundary test and a scan of the build output protect the browser bundle.

**Remaining risk:** a leaked secret key still reaches the Storage and Auth admin APIs, which grants can't narrow. Treat a leak as an incident: rotate the key and the URL signing key.

## Admin protection

- Customer signup is public, so it must never lead to admin access. New accounts always get the `customer` role, and the admin role is granted by hand with SQL. Never read roles from `user_metadata`, because users can edit it.
- Admin login is a separate page at `/admin/login`, and a logged-in customer who opens `/admin` gets no access.
- **App-based TOTP MFA is mandatory for admins. AAL2 is enforced for every admin page, read and action,** on the server and in the database. An `aal1` admin session can see only the MFA page.
- Use a strong unique password. Turn on MFA for the admin, Cloudflare, Supabase, GitHub, Resend and domain accounts.
- Enrol two authenticator devices. Docs disagree on recovery codes, so loss and recovery must be tested and written down.

**Locally verified JWT claims aren't enough on their own,** because a revoked session can pass until its token expires.

| Location | Required check |
|---|---|
| `proxy.ts` | `getClaims()` for refresh and redirects only. Never treated as authorisation. |
| Every `/admin` page render | `requireAdmin()`: `getUser()`, then admin role and AAL2, with `no-store` |
| Every admin server action or route | The same `requireAdmin()`, before any work |
| Every admin database read or write | `require_admin_session()`, in restrictive RLS and at the start of each function |
| Proof view URLs | Both of the above, then an access log entry |
| Customer `/account` | `getClaims()` plus RLS. `getUser()` for email or password changes. |
| Public pages | No session read |

`require_admin_session()` requires the admin role, `aal2` in the token, an active `auth.sessions` row matching the token's `session_id`, a verified factor in `auth.mfa_factors`, and a user who isn't banned. It relies on reading Supabase's `auth` tables, which must be proven locally and on the hosted platform. If verification can't complete, access is denied.

## Payment integrity

- **Only an admin with AAL2 who has seen the money in the bank or UPI account can record a receipt.** The form requires the amount, the source, and a UTR from the bank record.
- **A customer reference is a claim, not payment evidence.** It's required to request verification, and a screenshot is optional. A reference can move payment only from `pending` or `failed` to `submitted_for_verification`, and the order to `payment_verification`. Additional and late references change no status. No customer action can set `paid`, or change amounts or the ledger.
- **A proof upload alone changes no status at all.**
- Payment status is derived from ledger totals, and amounts change only through ledger functions.
- **Recording money and confirming an order are separate.** A genuine credit is recorded even if stock has gone, and the order isn't confirmed.
- One verified UPI transaction belongs to one order. A UTR can't be recorded as two receipts, and duplicate customer references are flagged, not blocked.
- Receipts, payment events and audit logs are append-only, even for admins. Mistakes are corrected with immutable correction events. **Genuine bank movements are never corrected or erased.**
- There's no write-off. A loss after a bank reversal stays under `financial_loss_review` until real money or a CA-approved treatment clears it.
- UPI setting changes are audit logged, and an email is sent to the owner once email exists.
- UPI PINs, passwords and banking credentials are never stored. The UPI ID and QR come from admin settings through the server, never from frontend code or `NEXT_PUBLIC_` variables.

## UPI QR (draft, not production-ready)

The QR's text content is stored in `store_settings`, so the QR needs no R2 or other new infrastructure. **These rules stay a draft until the owner's actual bank QR and the applicable specification are verified.** No QR setup or real payment test is authorised.

- The admin's browser decodes the bank's QR, and the image isn't kept. The **server** repeats every check: format, exactly one payee (`pa`) matching the configured UPI ID, payee name compared with a warning, no fixed amount, currency INR if present. It stores the original payload, parsed fields, classification and a server-computed hash.
- **Stored payloads are never modified.** Signed or merchant QRs stay as they are, and the customer types the amount.
- The hash and payee are rechecked on use. **Checkout stays closed if settings are missing, unverified or mismatched.** Changes need AAL2, and clear `upi_qr_verified_at`.
- The default path is the QR, plus "Pay exactly ₹X" with copy buttons, and a saved QR image for customers on phones. A separate amount link built from validated fields stays **off by default**, enabled per app only after testing.
- **The exact amount in UPI apps is unproven,** and sources conflict. Verification is the real control. The server can match the configured ID, but only a real payment proves ownership.

**Future UPI app tests, not yet run, needing separate approval and the owner's real UPI ID:** in GPay, PhonePe and Paytm, on Android and iPhone where available, test scanning from a second device, a saved QR image, the copied UPI ID, and any amount link for payee, amount and note, plus a small real payment showing a readable UTR. Any app that fails keeps the amount link off.

## WhatsApp privacy

WhatsApp is optional communication, never the order database. The order is always saved on the website first. The prefilled link holds only the Order ID, up to 5 items with name, variant, quantity and price, the total and the payment method. **It never holds a name, address, phone, email, private order token or payment reference.** The text can be edited by the customer, so the admin works from the Order ID.

## Secrets

| Value | Where it lives |
|---|---|
| Supabase secret key, Resend key, R2 access keys | `wrangler secret`, never in `wrangler` config files or code |
| Local values | `.dev.vars`, ignored by git. Never `.env`, `.env.local` or `.env.production`, because OpenNext compiles them into the Worker bundle. |
| CI values | GitHub Actions secrets |
| Backup encryption key | Owner's password manager, plus a safe offline copy |

- No `NEXT_PUBLIC_` variable may hold a secret. Build output is checked for secret values before go-live.
- `lib/supabase/admin.ts` and `services/storage` import `server-only`, so using them in browser code fails the build.
- The R2 token can reach only the images bucket. Backups use a separate token for the backups bucket.
- Rotate any key that appears in a commit, log or chat.

## Payment proof storage (plan)

A private Supabase Storage bucket is evaluated first, separate from public product images. No R2 or paid storage without the owner's separate approval. **A signed upload URL lasts 2 hours and can't be revoked individually.** The only global revoke is rotating the URL signing key, which kills every outstanding URL. So the design assumes a URL may leak.

| Control | Design |
|---|---|
| Ownership | Before issuing a URL, the server checks the customer's session or the guest's order token, and that the order can accept proofs |
| Unique paths | Server-generated `order_id/uuid.ext`, one URL per path. Customer file names are never used. |
| No overwrite | No upsert, and no overwrite permissions |
| Leak impact | A leaked URL can write one file to one path. It can't read anything, and what it writes stays hidden until finalised. |
| Finalise step | The file stays `pending` and invisible to admins until the server confirms it exists and checks its size and first bytes |
| Validation | JPEG, PNG and WebP only, no SVG, and a 5 MB cap (proposed). Bucket limits on signed uploads must be tested, and the finalise check applies regardless. |
| Rate limits | Per order (3 proofs, proposed), per hashed IP, plus a daily cap across the store to protect the 1 GB limit |
| Viewing | Signed URLs of about 60 to 120 seconds, issued after an AAL2 check, shown only as images. These can't be revoked either, so expiry is the control. |
| Logging | `proof_access_log` records issue, finalise, reject, view-issued and delete |
| Abandoned uploads | Listed for manual cleanup. No automatic deletion. |
| Emergency | A written runbook for rotating the URL signing key |

**Remaining risk:** the guest order link is a bearer token, so anyone holding it can upload within the limits. It can't change payment status.

Retention is provisionally 90 days after order closure, subject to CA and legal review, with documented exceptions for disputes and legal obligations. Automatic deletion isn't implemented yet.

### Required proof tests

| Case | Expected result |
|---|---|
| Expired upload URL | Upload fails after 2 hours, tested with a real wait, and no proof becomes visible |
| Cross-order access | Another customer's session, another order's token, a swapped proof ID or a different path are all refused |
| Repeated upload | A second upload on the same URL fails, the original is unchanged, and `x-upsert` is refused |
| Upload limit | A proof over the limit is refused and logged |
| Spoofed file type | HTML or SVG renamed `.jpg`, or a false `Content-Type`, is rejected at finalise and never shown to admins |
| Oversized file | Refused by the bucket if enforced, otherwise rejected at finalise |
| Unfinalised upload | Invisible to admins, and listed for manual cleanup |
| Rejected proof | Marked rejected with a reason and logged. A new upload is allowed within the limit. |
| Viewing access | Guests, other customers, `aal1` admins and revoked sessions are refused. Expired view URLs fail. |
| **No payment effect** | After every stage above, at every order state, `payment_status`, amounts, ledger rows and `order_status` are identical |
| **Reference limits** | A reference alone only reaches `submitted_for_verification`. It never creates a receipt, changes amounts or sets `paid`. A proof without a reference can't start verification. |

A static check also confirms that no proof function can write payment or order status columns, and that no such trigger or foreign key exists.

## Image storage

- Two buckets: public `images`, served through a custom domain, and private `backups`, with no public access.
- `r2.dev` access stays off in production.
- Uploads use presigned URLs issued only after `requireAdmin()`. Each is valid for 5 minutes, for one server-generated key and content type.
- Bucket CORS allows `PUT` only from the site's admin origin.
- Only WebP files of an expected size are accepted, as checked by the admin upload flow. Photo metadata is removed in the browser.

## Main risks

| Risk | What could happen | Protection |
|---|---|---|
| Fake payment screenshot | Goods shipped without money received | See payment integrity above |
| Tampered prices | Customer edits the cart or request | Browser sends only variant IDs and quantities. Prices come from the database. |
| Edited WhatsApp message | Customer changes the amount in the text | Admin works from the order number and database |
| Overselling | Two customers buy the last unit | Row locks and a database check inside `create_order` |
| Fake orders holding stock | Someone ties up low-quantity SKUs | 2-hour hold, limits per IP and phone, and on open unpaid orders per phone |
| Fake references holding stock | A reference stops automatic release until the admin acts | 3 references per order, 2 open orders per phone, 24-hour alert. An accepted cost of protecting genuine payers. |
| Stock held indefinitely | An open `manual_operational_review` has no time limit | Warnings and a daily review duty. No automatic release. **Awaiting owner approval.** |
| Missed schedule | No sweep or digest runs | Dashboard works without a scheduler, and the admin can run a sweep. Automatic expiry isn't claimed until tested. |
| Swapped UPI QR | Payments go to someone else | Server validation, admin only, audit logged, and checkout closes on mismatch |
| Refund to the wrong person | A completed refund can't be undone by correction | Wrong-order correction refused, manual path, CA review |
| Database owner bypass | `postgres` or `ledger_schema_owner` can disable triggers | Credential control and detection. Not preventable by design. |
| Single admin attestation | Nobody independently checks a correction | Reason code, statement check, audit entry and flag. A known limit. |
| Revoked admin session | A stolen or signed-out session keeps working | `getUser()` on the server, and active-session checks in the database. **Open gap (DEF-6):** locally, after Supabase detected refresh-token reuse, the newest refresh token still worked immediately afterwards, and an access token issued before detection still passed `getUser()`. A design for the cases our server can see awaits approval. Reuse detected only inside Supabase stays a residual risk until the access token expires. |
| Bots using up free limits | Daily 100,000 requests run out and the site goes down | Cloudflare bot and WAF rules run before the Worker where the free plan allows them. Crawl rules. Turnstile on checkout if abuse appears. |
| Surprise costs | R2 usage is billed and no hard cap was found | Admin-only uploads, CDN caching, weekly usage check. No Image Transformations. |
| Service suspended | A failed card makes R2 buckets return errors | Keep the payment method valid, watch the billing email |
| Account attacks | Password guessing or fake signups use up email limits | Supabase rate limits, a minimum password length, and Turnstile on signup if abuse appears. Login errors don't reveal whether an email exists. |
| Order link guessing | Someone reads another customer's address | Long random `public_token`, `noindex`, and a partly masked address |
| Changed UPI details | Payments go to someone else | Admin only, audit logged, email to owner |
| Email failure | Customer gets no message, or the order fails | Send after the order commits. Log quota errors, allow retry from admin. |
| Duplicate submission | Double tap creates two orders | Idempotency key, unique per order |
| Script injection | Stored text runs in the admin panel | React escaping, no raw HTML from users, Zod on all input, and security headers including CSP |
| Data loss | Supabase Free has no automatic backups | Daily encrypted backup and a proven restore, see below. Pro is budgeted before public launch, with no upgrade authorised. |
| Beta tooling fault | An adapter mishandles caching or auth | Compatibility test, private pages marked `no-store`, the real checks in Postgres |
| Private data cached | A cached page shows one customer's order to another | Order, checkout and admin responses are never cached, and a test proves it |

## Backups and recovery

Supabase's docs state "Automatic backups: Not included" for Free, and recommend off-site exports. **Nothing below is proven yet. The design isn't complete until the restore test passes on the hosted platform, using synthetic data and the owner's approval.** Commands are drafts, to be confirmed with `--help` and `--dry-run` on the pinned CLI, because its guide and reference disagree about `--remote`. `db dump` runs `pg_dump` in a container, so it needs a CI job or another tested environment.

### What each artefact covers

| Component | Artefact | Notes |
|---|---|---|
| Custom roles | `roles.sql` | None with login planned. Any found get a new password by hand. |
| App schema, public triggers, RLS | `schema.sql` | **Excludes the `auth` and `storage` schemas** |
| App data | `data.sql` | Public schema only, and must contain no Auth or Storage rows |
| **Auth users, identities, MFA factors** | `auth_data.sql` | **An explicit, separately verified component** |
| Migration history | `history_schema.sql`, `history_data.sql` | `supabase_migrations` schema |
| Signup trigger, bucket settings, Storage policies | `post_restore.sql` | Recreated from our own files |
| Cron jobs | `enable_cron.sql` | Run last |
| Auth settings, redirect URLs, SMTP, API keys | Written runbook | Not exportable as data. New keys are created. |
| Payment proof files | Undecided, see below | Not in any dump |
| Product images | R2, with originals on the owner's computer | Separate |

### Export

```bash
supabase db dump --remote="$DB_URL" -f roles.sql --role-only
supabase db dump --remote="$DB_URL" -f schema.sql
supabase db dump --remote="$DB_URL" -f data.sql --use-copy --data-only --schema public
pg_dump --data-only --table=auth.users --table=auth.identities --table=auth.mfa_factors \
  "$DB_URL" -f auth_data.sql
supabase db dump --remote="$DB_URL" -f history_schema.sql --schema supabase_migrations
supabase db dump --remote="$DB_URL" -f history_data.sql --use-copy --data-only --schema supabase_migrations
```

- `pg_dump` must be at least as new as the server. The connection URL stays in a secret and is never logged. If a job can't reach the direct connection over IPv4, it uses the Session pooler.
- **Auth checks.** The source database produces row counts and ID checksums for the three Auth tables, stored in a manifest. The job compares them with `auth_data.sql`, and the restore compares them with the new project.
- **Other Auth tables.** Sessions, refresh tokens and MFA challenges are deliberately left out, so everyone logs in again after a restore. The job fails if any Auth table we haven't accounted for holds data.
- **No double loading.** The job fails if `data.sql` contains Auth or Storage rows.
- **Protection.** The files hold personal data, password hashes and possibly MFA secrets. They're encrypted with a public key before upload, the private key stays offline, and they're never stored unencrypted or as CI artifacts. Copies are kept for 30 days in a private location, which needs separate R2 approval. **Until this works, no real customer data goes into the database.**
- The daily job also makes a real database query, which helps against pausing but isn't guaranteed.

### Restore

| Step | Component | Action | Verification |
|---|---|---|---|
| 0 | Site | Maintenance mode, no new orders | Checkout refuses orders |
| 1 | Project | New Mumbai project, same Postgres major version, with approval | Version matches the manifest |
| 2 | Settings | Apply the runbook: Auth, Confirm email on, TOTP, redirect URLs, SMTP, Data API | Checklist signed off |
| 3 | Extensions | Enable those in the manifest, including `pg_cron` | List matches |
| 4 | Privileges | Revoke Supabase's default grants to `anon`, `authenticated` and `service_role` on tables, sequences and functions in `public`, for every role that creates objects there, including `postgres`. Migrations also revoke API-role privileges on each object explicitly. | Checked in step 11 |
| 5 | Roles, schema, Auth, app data | The first `psql` command below | Counts and checksums match, including all three Auth tables |
| 6 | Migration history | The second `psql` command | Same versions listed |
| 7 | Triggers | Public triggers come from `schema.sql`. `post_restore.sql` recreates the `auth.users` signup trigger. | A new test signup gets `customer` |
| 8 | Bucket and Storage policies | `post_restore.sql` recreates the private bucket, limits and allowed types, and asserts the exact policy list | Private, no public URL, policies match |
| 9 | Storage objects | Option A or B, below | Every proof has a file or an honest status |
| 10 | Auth login and MFA | Test an existing password. Test the admin's original TOTP factor. If it fails, use the documented recovery and re-enrol. | Password works, and admin reaches AAL2 |
| 11 | Security audit | Compare grants, RLS, functions and policies with the source | No differences |
| 12 | Cron jobs | `enable_cron.sql` schedules jobs by name, only after verification | List matches, and no expiry runs early |
| 13 | App | Create new keys, update secrets and redeploy, with approval | Smoke test passes |
| 14 | Reopen | Reconcile the ledger, then leave maintenance mode | Totals match the manifest |

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file auth_data.sql --file data.sql --dbname "$NEW_DB_URL"

psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file history_schema.sql --file history_data.sql --dbname "$NEW_DB_URL"

psql --variable ON_ERROR_STOP=1 --file post_restore.sql --dbname "$NEW_DB_URL"
# Storage step, login and audit checks here.
psql --variable ON_ERROR_STOP=1 --file enable_cron.sql --dbname "$NEW_DB_URL"
```

`SET session_replication_role = replica` lasts only for that `psql` session, so triggers run normally afterwards. The guide's known `supabase_admin` and `cli_login_postgres` errors go in the runbook. The store doesn't use Vault, so its root-key step doesn't apply.

### Payment proof files: undecided

Options A and B stay undecided, pending the review in `CA_LEGAL_REVIEW.md`. No S3 keys, copies or automatic deletion are implemented.

- **Option A, no off-site copy:** `post_restore.sql` marks affected proofs `file_unavailable_after_restore`, and admins see that plainly. Payment status doesn't change.
- **Option B, encrypted copy:** decrypt, then upload each file to its original path through Storage, so metadata rows are created. Compare every checksum with the manifest. The upload method needs testing.

### Restore test before any real data

Uses labelled synthetic data, first locally, then against the actual hosted Supabase version. Hosted tests need separate approval.

It passes only if:

- `postgres` can read and load `auth.users`, `auth.identities` and `auth.mfa_factors`, and column differences between Auth versions are handled
- Row counts and checksums match for all Auth tables and app tables, and ledger totals reconcile
- Existing passwords work, identities stay linked, and new signups get `customer`
- The original TOTP factor works, or re-enrolment is proven
- Security audits match, and append-only guards block changes
- Order numbers continue correctly
- Bucket, policies and cron jobs are correct, and proof files follow the chosen branch
- Recovery time is measured, and the owner accepts the 24-hour data-loss window

**Write-lock stamps:** `post_restore.sql` must clear every `orders.write_lock_tx`, because a restored value could equal a future transaction ID. Roles, ownership, grants, triggers and the catalogue checks must also match after restore. None of this has been tested.

**If the hosted platform blocks the Auth export or load,** the backup design stays incomplete and real customer data stays blocked until the owner chooses an alternative, which may include password resets or a paid backup route.

Repeat a full restore every 3 months after launch.

**Inactivity pause**

- Supabase pauses Free projects with low database activity over 7 days. A few real database requests each day are typically enough to prevent this.
- The daily backup job also makes a real database query for this reason. It's helpful, not guaranteed.
- A warning email comes about a week before, and another once paused. Keep that inbox watched.

**If something goes wrong**

| Situation | Action |
|---|---|
| Project paused | Dashboard, Resume project. Paused projects can be resumed for up to 1 year. The docs give no restore time, so measure it in the test. Meanwhile, checkout is unavailable. Tell customers by WhatsApp, and don't record orders outside the database. |
| Read-only or 402 restrictions | Lifted when the quota refills next billing cycle, or upgrade to Pro with owner approval |
| Data lost or corrupted | Follow the restore procedure above. |
| Project deleted | Supabase backups go with it, so only the off-site copies remain |

**Note:** the store doesn't use Vault, because its key can't be fetched from a paused project.

**Free-plan limits to plan around:** 2 active projects, so a real restore test needs the test project paused. Free isn't assumed suitable for a public store, and the risks are in section 8 of `PROJECT_ARCHITECTURE.md`.

## Personal data

Customer names, phones and addresses are personal data, and the DPDP Rules are now in force.

- Collect only what's needed to fulfil the order, and explain why on the checkout form and privacy page.
- Keep marketing consent as a separate, unticked choice.
- WhatsApp links hold no address, phone or token, and customer references are personal data with retention under CA review.
- Don't put addresses or phones in logs or analytics. Workers Logs are on by default, so never log request bodies.
- Avoid exporting customer data to personal chats or spreadsheets where possible. Limit what goes to the courier.

## Legal items to confirm with a CA or lawyer

The full question list is in `CA_LEGAL_REVIEW.md`.

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
- [ ] An order can't be confirmed, processed or dispatched without `paid`, zero refund liability and no blocking flag, and `paid` never confirms by itself
- [ ] Every status pair is tested: allowed moves pass, all others fail, and cancelled orders can't be reinstated
- [ ] Simultaneous admin confirmation and expiry give exactly one result, and stock moves once
- [ ] Tests show that a role-removed, factor-removed or banned admin, and a signed-out session, are denied on the next request even with an unexpired token. Only the signed-out case has local evidence so far (Level 2, AU6); the role, factor and ban cases are untested. `aal1` admins see only the MFA page. Refresh-token reuse (DEF-6) is tested and recorded separately, with no immediate revocation claimed unless a test demonstrates it. Reuse detected only inside Supabase stays a residual risk until the access token expires (see `docs/test-evidence/LEVEL2_ISSUES.md`).
- [ ] The secret key can't read tables or call admin functions
- [ ] A partial credit can't become an unpaid retry, and each flag blocks exactly its groups
- [ ] Corrections validate per reason code, wrong-order is all-or-nothing on both orders, duplicate corrections are refused, and a completed refund refuses correction
- [ ] Write-lock tests pass: forged settings, direct writes, no stamp, another order's stamp, `NV102`, savepoints, and role and catalogue checks
- [ ] Actual bank QR and specification verified, and UPI app tests recorded
- [ ] A scheduler is configured and tested before automatic expiry is relied on
- [ ] All required proof tests pass, including the no-payment-effect test
- [ ] Payment and audit rows can't be edited or deleted
- [ ] Order and admin responses are never cached
- [ ] Production bundle contains no secret values
- [ ] MFA is on for all service accounts
- [ ] Encrypted backup and restore tested on the hosted platform, including Auth users, identities and MFA factors
- [ ] `r2.dev` access is off, and CORS is limited
