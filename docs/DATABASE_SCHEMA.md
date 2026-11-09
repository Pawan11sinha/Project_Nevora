# NÉVORA database schema

Status: V1 design, updated on 7 November 2026. **Nothing here is built. No SQL has been run, and no test in this document has been executed.** Every rule is a design subject to implementation and testing on the target PostgreSQL version. Nothing here is verified or production-ready. Decisions still awaiting the owner are listed in section 6 of `IMPLEMENTATION_ROADMAP.md`.

V1 is **prepaid manual UPI only**. COD, payment gateways, courier APIs, automated verification and automated refunds are out of scope, and their design is kept under "After launch".

Conventions: `uuid` primary keys unless noted, `timestamptz` for `created_at` and `updated_at`, and integer paise for money (columns end in `_paise`). All foreign keys are indexed.

**Deletion (finding 18, decided 7 November 2026):** every foreign key states `ON DELETE RESTRICT`. No application role (`anon`, `authenticated`, `service_role`), and neither `ledger_owner` nor `lock_owner`, has `DELETE` or `TRUNCATE` on any table. This relies on role separation. **It doesn't stop the table owner, the migration role or a database administrator,** who can delete rows, drop constraints or disable triggers, so the application never uses those roles. How account deletion treats `customer_id` and staff actor keys is decided with those keys in C1b, and stays a CA question.

**No image data is stored in the database, and product images aren't stored in Supabase Storage.** Tables hold only object keys and metadata. Private payment proofs are the one planned use of Supabase Storage, subject to the evaluation in `PROJECT_ARCHITECTURE.md`.

## Table order

30 tables in the first migrations, in this order. `invoices` and `credit_notes` are added later, making 32.

| # | Tables |
|---|---|
| 1–8 | `profiles`, `categories`, `products`, `product_variants`, `product_images`, `collections`, `collection_products`, `trending_picks` |
| 9–11 | `store_settings`, `rate_limits`, `audit_logs` |
| 12–16 | `orders`, `order_items`, `order_transitions`, `order_status_history`, `order_cancellations` |
| 17–19 | `payment_transitions`, `payment_status_history`, `payment_submissions` |
| 20–22 | `shipments`, `returns`, `return_items` |
| 23–25 | `refunds`, `payment_receipts`, `payment_events` |
| 26–29 | `payment_proofs`, `proof_access_log`, `stock_movements`, `notifications` |
| 30 | `order_review_flags` |

Each foreign key's parent is created before its child, and there are no cycles: `refunds` has no key to receipts or events. Self-references are nullable.

**Build split (decided 7 November 2026):** C1 creates 20 tables: `profiles`, `categories`, `products`, `product_variants`, `store_settings`, `rate_limits`, `audit_logs`, `orders`, `order_items`, `order_transitions`, `order_status_history`, `payment_transitions`, `payment_status_history`, `payment_submissions`, `refunds`, `payment_receipts`, `payment_events`, `stock_movements`, `notifications` (in C1b, because `create_order` queues its notification) and `order_review_flags`. C2 creates the other 10: `product_images`, `collections`, `collection_products`, `trending_picks`, `order_cancellations`, `shipments`, `returns`, `return_items`, `payment_proofs` and `proof_access_log`. No C1 key points to a C2 table. The two administrator-session tables proposed for DEF-6 are a separate future approval, outside these 30.

## Catalogue

**categories**: `id`, `parent_id` → categories (nullable), `name`, `slug` (unique), `description`, `image_key`, `sort_order`, `is_active`.
New categories need no code changes.

**products**: `id`, `category_id` → categories, `name`, `slug` (unique), `description`, `material`, `care_instructions`, `dimensions`, `hsn_code`, `gst_rate_bps`, `country_of_origin` (CA review), `status` (`draft`, `active`, `archived`), `is_featured`.
Full-text search index on name and description.

**product_variants**: `id`, `product_id` → products, `sku` (unique), `option_label` (for example "Silver" or "Default"), `price_paise` (> 0), `mrp_paise` (≥ price), `cost_paise` (admin only), `opening_stock` (≥ 0, default 0, immutable), `stock_on_hand` (≥ 0), `stock_held` (≥ 0), `low_stock_threshold`, `is_active`.
Every product has at least one variant. Price and stock live here. Available stock is `stock_on_hand - stock_held`, with a check that it can't go below zero.

**product_images**: `id`, `product_id` → products, `variant_id` (nullable), `r2_key_base`, `version`, `original_width`, `original_height`, `alt_text`, `sort_order`.
Files are stored in R2 as `<r2_key_base>-v<version>-<width>.webp`, with widths 400, 800 and 1600.

**collections**: `id`, `slug` (unique), `name`, `intro`, `max_price_paise` (nullable, for Under ₹299 and Under ₹499), `sort_order`, `is_active`.
**collection_products**: `collection_id`, `product_id`, `sort_order`.
These back the lightweight Shop by Aesthetic pages. There's no manager screen until after launch, and a collection without real products stays hidden.

**trending_picks**: `id`, `product_id`, `label`, `sort_order`, `is_active`, `starts_at`, `ends_at`. Manual at launch.

## Orders

**orders**:
- Identity: `id`, `order_number` (unique, from a sequence, for example `ORD-1001`), `public_token` (unique, random, used for the private order link), `idempotency_key` (unique), `idempotency_hash`, `is_test`.
- Customer snapshot: `customer_id` → profiles (null for guest orders), name, phone, `customer_phone_normalised` and email.
- Address snapshot: shipping lines, city, state name, `state_code` and `pincode`, plus billing fields if the CA requires them, and `notes`. Later profile changes never alter an order.
- State: `status`, `payment_method` (`upi_manual` only in V1, extendable later), `payment_status`.
- Amounts set at creation: `subtotal_paise`, `shipping_paise`, `discount_paise` (0 at launch), `tax_total_paise`, `prices_include_tax` (CA review), `total_paise`.
- Amounts maintained only by ledger functions: `amount_received_paise`, `amount_refunded_paise`. These cache ledger totals. A deferred check at commit refuses any transaction where they, or the stored `payment_status`, don't match the ledger.
- Deadlines and retry: `hold_expires_at`, `retry_expires_at`, `submission_grace_until`, `payment_failure_count`.
- Dates: `confirmed_at`, `shipped_at`, `delivered_at`, `reinstated_at`, `reinstated_by`, `closed_at`.
- Links: `related_order_id` → orders (nullable), `relation_type` (`reorder_after_rto`, `reorder_after_cancellation`, `replacement`). Money never transfers between linked orders.
- Control: `financial_version`, `submission_version`, `write_lock_tx`.

Check: `total_paise = subtotal_paise + shipping_paise - discount_paise`.

**order_items**: `id`, `order_id` → orders, `variant_id` → product_variants, `product_name`, `variant_label`, `sku`, `hsn_code`, `unit_mrp_paise`, `unit_price_paise`, `quantity` (> 0), `discount_allocated_paise`, `taxable_value_paise`, `gst_rate_bps`, `cgst_paise`, `sgst_paise`, `igst_paise`, `cess_paise`, `line_total_paise`, `unit_cost_paise`.
Text, prices and tax are snapshots. Tax fields are placeholders for CA review. Discounts are allocated in integer paise, with rounding remainders assigned deterministically so lines always add up. Variants that have been ordered can be archived but not deleted. `unit_cost_paise` is admin only: customers read their order items through a limited view that leaves it out.

**order_transitions** and **payment_transitions** (reference data, migration only): `from_status`, `to_status`, `allowed_actor`.

**order_status_history** and **payment_status_history** (append-only): `id`, `order_id`, `from_status`, `to_status`, `actor_id`, `reason`, `created_at`. Separate typed tables keep real foreign keys and enums. Refund and return changes use triggers and `audit_logs`.

**order_cancellations** (append-only): `id`, `order_id` (unique), `reason`, `initiated_by`, `created_at`.

## Customer payment claims

**payment_submissions**: `id`, `order_id`, `reference`, `reference_normalised`, `status`, `is_duplicate`, `ip_hash`, `reviewed_by`, `reviewed_at`, `superseded_at`, `superseded_by`, `created_at`.

These are **customer claims, never money**. No submission creates a receipt or event, and none can set `paid`.

| From | To | By |
|---|---|---|
| Start | `submitted` or `late` | `submit_payment_reference` |
| `submitted`, `late` | `matched` | A linked `record_verified_payment` |
| `submitted`, `late` | `rejected` | `reject_submission` |
| `submitted` | `superseded` | `cancel_order`, reason `order_cancelled`, one audit entry each |
| `superseded` | `matched` | A later verified credit, if the admin links it |
| `matched` | `submitted` | Correction of the linked credit |

All rows stay visible to the admin and count toward the limit of 3 references per order. `late` submissions aren't "open" for any guard. Only `submitted` is.

### Reference rules

**A reference is mandatory for a customer to request verification. A screenshot is optional, and a proof alone can't start verification.** An admin who finds a credit in the bank needs no customer reference.

| Order and payment | Customer submits | Result |
|---|---|---|
| `pending_payment`, `pending` or `failed`, submission open | First or retry | `submitted_for_verification` + `payment_verification` |
| `payment_verification`, `submitted_for_verification` | Additional | Saved, no status change |
| `payment_verification`, `confirmed` or `processing`, `verification_required`, Collected below total | Additional | Saved, admin alerted, no status change |
| `pending_payment`, submission closed, no flag blocking expiry | Late | Saved as `late`. **The same transaction expires the order**, releases stock, and opens `late_reference`. |
| `pending_payment`, submission closed, `manual_operational_review` open | Late | Saved as `late`, no flag, no status change. The flag, not the reference, holds the stock. `late_reference` opens when the order later expires. |
| `expired` or `cancelled`, payment `cancelled` or `verification_required` | Late | Saved as `late`, `late_reference` opens, no status change, no stock held. A closed order also reopens financially. |
| `paid` or `refunded`, on any order including closed ones | Any | Refused, logged, not saved, doesn't count, doesn't reopen closure |
| Fourth reference | Any | Refused and logged |

A duplicate reference opens `duplicate_reference` and is never blocked, so nobody can block a genuine payment by submitting another customer's UTR first.

## Payment ledger

| Table | Meaning | Moves money? |
|---|---|---|
| `payment_receipts` | **Evidence:** a real money movement seen in the bank or UPI account | Records one |
| `payment_events` | **Accounting effect** on the order, and the only source for ledger totals | Records the effect |
| `refunds` | **Obligation and workflow:** what's owed and its state | No |

**One verified UPI transaction belongs to exactly one order.** There's no multi-order allocation in V1. One order may have several transactions.

**payment_receipts** (append-only, never edited or deleted): `id`, `order_id` (required), `kind`, `direction`, `channel` (`upi`, `bank`, later `razorpay`), `amount_paise` (> 0), `reference`, `reference_normalised`, `reference_generation`, `verified_source` (`bank`, `upi_app`, later `gateway`), `submission_id` (nullable), `refund_id` (nullable), `reverses_receipt_id` (nullable), `verified_by` → profiles, `received_at`, `verified_at`, `note`.

**payment_events** (append-only, never edited or deleted): `id`, `order_id`, `receipt_id` (nullable), `corrects_event_id` (nullable), `replaces_event_id` (nullable), `type`, `amount_paise` (> 0), `actor_id`, `note`, `correction_reason`, `statement_checked_at`, `created_at`.

**Every receipt has exactly one event. Every money event has exactly one receipt. Only `entry_correction` has no receipt.**

| Situation | Receipt | Event | Refund record | Effect |
|---|---|---|---|---|
| Customer credit | In, `customer_credit`, bank UTR | `upi_received` | None | Collected up |
| Bank reversal | Out, `bank_reversal`, links to the credit | `bank_reversal` | None | Collected down |
| Refund initiated | None | None | New, `due` | Liability up |
| Refund cancelled | None | None | `due → cancelled` | Liability down |
| Refund sent | Out, `refund_debit`, links to the refund | `refund_completed` | `due → completed` | Liability down, Refunded up |
| Refund returned by the bank | In, `refund_returned`, links to the debit and refund | `refund_returned` | `completed → returned`, plus new `due` with `retry_of` | Refunded down, Liability up |
| Entry correction | **None** | `entry_correction` | Only as in "Entry corrections" | Removes the corrected event from totals |

**Ledger constraints**, all enforced by the database (design, not yet tested):

- `UNIQUE (receipt_id)`, `UNIQUE (corrects_event_id)` and `UNIQUE (replaces_event_id)` on `payment_events`.
- `receipt_id` is null only for `entry_correction`, and `corrects_event_id` is set only for `entry_correction`.
- A deferred check requires every receipt to have its event by commit.
- Event type must match receipt kind: `upi_received` with `customer_credit`, `bank_reversal` with `bank_reversal`, `refund_completed` with `refund_debit`, `refund_returned` with `refund_returned`.
- Kind must match direction: `customer_credit` and `refund_returned` are in, `bank_reversal` and `refund_debit` are out.
- A money event's amount equals its receipt's amount, and a correction's amount equals the event it corrects.
- `reverses_receipt_id` is required on `bank_reversal` and points to a `customer_credit`, and required on `refund_returned` and points to a `refund_debit`. It's null on other kinds.
- `refund_id` is required on `refund_debit` and `refund_returned`, and null on other kinds.
- Active reversals of one credit can't total more than that credit, checked with the credit's order locked.
- A correction can't target an `entry_correction`.

Bank reversals can be partial, and their total can't exceed the original credit. A refund record is one payment, so a returned refund returns its full amount. A bank returning only part of a refund isn't supported in V1 and goes to the manual path.

### Accounting
These are **order-level ledger calculations, not the bank balance**. Totals use active rows only. An active receipt is one whose event hasn't been corrected. Corrected receipts stay visible forever.

| Term | Calculation |
|---|---|
| **Collected (A)** | Active `customer_credit` minus active `bank_reversal` |
| **Refunded (B)** | Active `refund_debit` minus active `refund_returned` |
| **Refund liability (C)** | Refund records still `due` |
| **Net customer funds retained** | A - B |
| **Net amount after refund obligations** | A - B - C |

B + C can't exceed A when a refund is created or completed. A genuine bank reversal may break this, which is what triggers review.

**`derive_payment_status`** runs after every ledger event, from ledger totals and never from the previous status:

| Order | Condition | Status |
|---|---|---|
| 1 | B > A | `verification_required`, plus `financial_loss_review` |
| 2 | A > 0 and B = A | `refunded` |
| 3 | A ≥ order total | `paid`, including after a partial refund |
| 4 | A > 0 | `verification_required` |
| 5 | A = 0, with active or corrected receipts | `verification_required` |
| 6 | No receipt ever | Workflow status stays |

C doesn't affect payment status. It affects guards.

**Resolved workflow status:** rule 5 applies when a ledger event leaves A at 0. Once A, B and C are all 0 and no active receipt exists, a `failed` set through `GUARD_RETRY`, or a `cancelled` set through `mark_payment_cancelled`, stands until the next ledger event. `failed` and `cancelled` are only reachable this way or when no receipt ever existed, and the deferred check treats them as matching the ledger.

**Worked examples for a ₹1,000 order:**

| Case | A | B | C | Retained | After obligations | Status |
|---|---|---|---|---|---|---|
| Paid in full | 1,000 | 0 | 0 | 1,000 | 1,000 | `paid` |
| ₹300 refund initiated, not sent | 1,000 | 0 | 300 | 1,000 | 700 | `paid` |
| ₹300 refund completed | 1,000 | 300 | 0 | 700 | 700 | `paid`, partly refunded |
| Full refund completed | 1,000 | 1,000 | 0 | 0 | 0 | `refunded` |
| Full refund returned by the bank | 1,000 | 0 | 1,000 | 1,000 | 0 | `paid`, progress blocked by C |
| ₹1,500 credited, ₹500 reversed | 1,000 | 0 | 0 | 1,000 | 1,000 | `paid`, with `bank_reversal` |
| ₹1,000 credited, ₹400 reversed | 600 | 0 | 0 | 600 | 600 | `verification_required` |
| Reversal after a full refund | 0 | 1,000 | 0 | -1,000 | -1,000 | `verification_required`, loss flag |
| Sole credit corrected, no replacement | 0 | 0 | 0 | 0 | 0 | `verification_required` |
| ₹1,000 corrected to ₹600 | 600 | 0 | 0 | 600 | 600 | `verification_required` |

A reversal on a `refunded` payment always gives `verification_required`, because B = A before it, so any reversal makes B > A.

### UTR uniqueness
Partial unique index on `(kind, reference_normalised, reference_generation)` where a reference exists. It's global across orders. `order_id` isn't part of the key. References are required on `customer_credit` and `refund_debit`, and optional on `bank_reversal` and `refund_returned`, which then need a note.

`reference_generation` is computed by a trigger, under a per-reference lock, and never trusted from the caller. A later generation is accepted only when every earlier receipt with that kind and reference has been corrected.

### Refunds

**refunds**: `id`, `order_id`, `return_id` (nullable, **added in C2** with its `(return_id, order_id)` key, once `returns` exists), `retry_of` (nullable, unique), `origin` (`cancellation`, `late_credit`, `excess`, `admin`, `retry`, and `return`, **added in C2**), `amount_paise`, `reason`, `status`, `completed_at`, `cancelled_at`, `created_by`, `created_at`. Amount and origin never change.

| From | To | Requires |
|---|---|---|
| Start | `due` | Inserting any other status fails |
| `due` | `completed` | Its `refund_debit` receipt and event, in the same transaction |
| `due` | `cancelled` | Reason |
| `completed` | `returned` | Its `refund_returned` entry, and a new linked `due` record |
| `completed` | `voided` | **Correction workflow only**, with a new linked `due` record |
| `returned` | `completed` | **Correction workflow only**, with the retry still `due`, which becomes `cancelled` |

`cancelled` and `voided` are final. That's 5 allowed moves and 15 invalid pairs. A trigger allows at most one active receipt per kind per refund.

| Situation | Refund position |
|---|---|
| Cancelled, no money received | Nothing to refund, and no refund record |
| Cancelled, money received | Refund `due` created automatically for **A - B - C**, only if above 0, `origin = cancellation` |
| Full or part credit arrives after cancellation | Refund `due` created automatically for that credit, **capped at A - B - C after the credit**, only if above 0, `origin = late_credit` |
| Late credit on an expired order | No automatic refund, because it may be reinstated |
| Overpayment | Admin creates the refund, `origin = excess`, not automatic |
| Partial refund | Payment status doesn't change, and the refunded amount is shown separately |

Refund amounts, and whether shipping is refundable, are CA and policy questions. Refunds don't change order status. A refund can happen without a return, and a return without a refund.

### Entry corrections

Corrections are for **genuine data-entry mistakes only**. `record_entry_correction` adds one correction event, linked by `corrects_event_id`, with a reason code, note and audit entry. It adds no receipt and changes no existing row. A correction can't itself be corrected. Dependent entries are corrected latest first.

| Reason | Meaning | Replacement | Generation |
|---|---|---|---|
| `entered_in_error` | No such movement happened | **Forbidden** | Reference is freed for a later real entry |
| `wrong_order` | Same transaction, wrong order | **Required, same kind, UTR and amount, different order** | Old reference, next generation |
| `wrong_amount` | Same transaction, wrong amount | **Required, same order and reference, different amount** | Old reference, next generation |
| `wrong_reference` | Same transaction, wrong reference | **Required, same order and amount, different reference** | New reference: 0, or next if earlier uses were corrected. Refused if active. |

A replacement is in the same transaction, linked permanently by `replaces_event_id`. A deferred trigger requires both sides. `replaces_event_id` is unique, and crosses orders only for `wrong_order`.

| Kind | Allowed codes | Refused while | On success |
|---|---|---|---|
| `customer_credit` | All four | Active reversal exists, or B + C would exceed A | Status derived |
| `bank_reversal` | `entered_in_error`, `wrong_amount`, `wrong_reference` | **Never for a real reversal** | Attestation with statement check required |
| `refund_debit` | `entered_in_error`, `wrong_amount`, `wrong_reference` | An active `refund_returned` exists | `wrong_reference` keeps the record. Others: `completed → voided` and a new record. |
| `refund_returned` | `entered_in_error`, `wrong_reference` | Its retry has been completed | `entered_in_error`: `returned → completed`, retry `cancelled` |

Every correction opens `entry_corrected`. **Genuine bank movements are never corrected:** if the bank puts reversed money back, record a new `customer_credit`.

**Limit:** the database can't independently prove an attestation, especially with one admin. The rule is enforced by the reason code, statement-check attestation, audit entry and flag.

### Wrong-order correction

One transaction, for customer credits only:

1. Check admin, AAL2, active session, reason code and attestation. Source and target must differ.
2. Lock both orders in ascending ID order, then the reference, then the receipt and listed refunds.
3. Validate: the event is uncorrected, there's no active reversal, and after removal `B ≤ A'` and `B + C' ≤ A'`, where A' removes the credit and C' removes listed `due` refunds.
4. Cancel listed `due` refunds, with a reason.
5. Source: insert the correction event.
6. Target: insert the replacement receipt at the next generation, then its event.
7. Recalculate and derive status on both.
8. Open `entry_corrected` on both, plus the target effects below.
9. Clear `closed_at` on either if closed, and open `post_closure_activity`.
10. Both `financial_version` values rise, with audit and history on both, using one correlation ID.
11. Commit, or roll back everything. Original receipts and events stay permanently.

**Source:** order status and stock never change.

| Target | Order after | Stock | Other flags | Refund |
|---|---|---|---|---|
| `pending_payment` | `payment_verification` | Held | `amount_mismatch` if under, `overpayment` if over | None automatic |
| `payment_verification` | Same | Held | Same | None automatic |
| `confirmed`, `processing` | Same | Held | `overpayment` if over | None automatic |
| `shipped`, `delivered`, `returned` | Same | No change | `overpayment` if over | None automatic |
| `expired` | Stays `expired` | None | `late_payment`, `amount_mismatch` if under | None automatic |
| `cancelled` | Stays `cancelled` | None | `late_payment` | Automatic `due`, `origin = late_credit` |

### Refused correction: manual path

A correction is **refused while the source has refunded money that isn't recovered**. A completed refund is a real payment that left the account. The refusal changes no ledger, status, version or stock, and its evidence is kept as described in "Refusal evidence".

| Situation | Result |
|---|---|
| Refund completed, not recovered | Refused, manual path |
| Partial refund completed | Refused until that money is recovered |
| Refund bounced in full | Allowed once the retry `due` is listed for cancellation |
| Bank returns only part of a refund | Not supported, manual path |
| Credit reversed by the bank, fully or partly | Refused |
| Refund still `due` | Allowed only if listed for cancellation |
| Another genuine credit covers the refund | Allowed, since the check uses totals |

The admin may then run `open_cross_order_review`, which locks both orders ascending and opens `manual_payment_review` on each, atomically, with cross-references:

| Order | Payment effect | Order effect | Stock |
|---|---|---|---|
| Target `pending_payment` | `pending` or `failed` → `verification_required` | **→ `payment_verification`**, required | Held |
| Target `payment_verification`, `submitted_for_verification` | → `verification_required` | None | Held |
| Every other source or target status | None | None | No change |

The target stays unpaid, since its UTR is still active on the source. **No ledger row is created, and V1 has no write-off.**

**Recovery transfers stay manual in V1.** A voluntary transfer back from a refund recipient isn't obviously a customer payment or a bank return. It isn't recorded as a receipt, and its reference goes in the flag's notes. A new `refund_recovered` kind is a separate business and CA decision. A genuine new payment for the order is still a normal `customer_credit`.

## Payment proofs

**payment_proofs**: `id`, `order_id`, `submission_id` (nullable), `storage_path` (unique, server-generated), `status` (`pending`, `finalised`, `rejected`, `file_unavailable_after_restore`, `deleted`), `mime_type`, `size_bytes`, `rejected_reason`, `reviewed_by`, `reviewed_at`, `retain_until`, `legal_hold`, `legal_hold_reason`, `deleted_at`, `created_at`. Unique on `(id, order_id)`.

**proof_access_log** (append-only): `id`, `order_id`, `proof_id`, `action` (`upload_url_issued`, `finalised`, `rejected`, `view_url_issued`, `deleted`), `actor_id`, `ip_hash`, `created_at`. `order_id` references `orders (id)`. `(proof_id, order_id)` references `payment_proofs (id, order_id)`, both `ON UPDATE RESTRICT ON DELETE RESTRICT`. Indexed on `(proof_id, order_id)` and `(order_id, created_at)`. A view entry records that a URL was issued, not proof it was opened.

**Proofs have no link to receipts, events, payment status or order status.** A proof upload changes no status.

## Fulfilment

All details are entered manually by the admin. There's no courier API, and history is in `audit_logs`.

**shipments**: `id`, `order_id` (unique, one shipment per order in V1), `status` (`dispatched`, `delivered`, `rto_in_transit`, `rto_received`), `courier_name`, `awb`, `tracking_url`, `dispatched_at`, `delivered_at`, `rto_started_at`, `rto_received_at`, `rto_reason` (`refused`, `undelivered`, `address_issue`), `note`, `updated_by`.

| Action | Admin enters | Effect |
|---|---|---|
| `record_dispatch` | Courier, AWB, date, optional tracking link | Shipment `dispatched`, order `shipped`, stock reduced |
| `record_delivery` | Delivery date | Shipment and order `delivered` |
| `record_rto_started` | Date and reason | `rto_in_transit`, RTO return opened, order stays `shipped` |
| `record_rto_received` | Date and condition note | `rto_received`, order `returned`, inspection required |
| `correct_shipment_details` | Fix and reason | Details updated, old and new audited |

**returns**: `id`, `order_id`, `shipment_id` (nullable), `kind` (`customer_return`, `rto`), `status`, `reason`, `received_at`, `opened_by`, `created_at`.

**return_items**: `id`, `order_id`, `return_id`, `order_item_id`, `quantity`, `inspection_result` (`pass`, `fail`), `inspected_by`, `inspected_at`.

| | Customer return | RTO or undelivered parcel |
|---|---|---|
| Delivered? | Yes | No |
| Scope | Full or partial, by item | Whole parcel |
| Order status | **Stays `delivered`**, return state derived | `shipped`, then `returned` only when physically received |
| Shipment | Stays `delivered` | `dispatched → rto_in_transit → rto_received` |
| Stock | Passed items added back, failed items a `write_off` | Same |
| Refund | Separate decision per policy | Separate decision per policy |

Quantities can't exceed quantity bought minus already returned. **Stock is restored only by a passed inspection.** Return status: `open → received → inspected → closed`, or `open → rejected` for customer returns only. That's 4 allowed moves, and 16 invalid pairs plus RTO rejection.

Partial shipments and partial cancellations are out of scope at launch. After an RTO, a new linked order is allowed.

**Lost parcels aren't final, and must be settled before M6.** Starting proposal: a parcel with no delivery past a set number of days is flagged, and marked lost only with the courier's confirmation. Stock was reduced at dispatch, so nothing is released, and it's added back only if the parcel returns and passes inspection. Refund or replacement is decided per case, with replacement as a new linked order. The order end state, replacement pricing and courier claims are open.

## Tax documents (after CA answers)

**invoices** and **credit_notes** are added by a later migration, once `CA_LEGAL_REVIEW.md` is answered. The draft fields follow CGST Rule 46: a number unique per financial year and at most 16 characters, date, seller name, address and GSTIN, buyer snapshot, place of supply, reverse-charge flag and tax split. They aren't final.

## Status values

| Order status | Customer sees | Meaning | Stock |
|---|---|---|---|
| `pending_payment` | **Order placed, not yet confirmed** | Saved, waiting for payment | Held |
| `payment_verification` | We're checking your payment | Reference submitted or credit recorded | Held |
| `confirmed` | **Confirmed** | Money verified, stock secured, admin confirmed | Held |
| `processing` | Preparing your order | Being packed | Held |
| `shipped` | Shipped | With courier | Removed from on-hand |
| `delivered` | Delivered | Complete | None |
| `cancelled` | Cancelled | Cancelled before dispatch | Released |
| `expired` | **Expired, order wasn't confirmed** | Window ended with nothing received | Released |
| `returned` | Returned to us | Whole parcel never reached the customer | Added back only after inspection |

| Payment status | Customer sees | Meaning |
|---|---|---|
| `pending` | Payment pending | Nothing submitted |
| `submitted_for_verification` | We're checking your payment | Reference submitted, unchecked |
| `verification_required` | We're reviewing your payment | Problem found: wrong amount, reversal, late credit or a manual review |
| `paid` | Payment verified | **Admin has seen the credit in the bank or UPI account** |
| `failed` | We couldn't verify this payment | No credit found. Not an accusation. |
| `cancelled` | Cancelled | Ended with no money recorded |
| `refunded` | Refunded | All collected money refunded |

Emails use the same wording, and the "order received" email never says "confirmed". While paid but unconfirmed, customers see "Payment verified, we're confirming your order".

### Allowed status pairs
Enforced by a deferred trigger at commit.

| Payment | Allowed orders |
|---|---|
| `pending`, `failed` | `pending_payment` |
| `submitted_for_verification` | `payment_verification` |
| `verification_required`, `paid`, `refunded` | `payment_verification`, `confirmed`, `processing`, `shipped`, `delivered`, `returned`, `expired`, `cancelled` |
| `cancelled` | `expired`, `cancelled` |

### Payment transitions

| From | To | Trigger | Who |
|---|---|---|---|
| `pending` | `submitted_for_verification` | Reference while submission is open | Customer |
| `pending` | `paid` | Full credit | Admin |
| `pending` | `verification_required` | Part credit, or `manual_payment_review` | Admin |
| `pending` | `cancelled` | Expired or cancelled | System or admin |
| `submitted_for_verification` | `paid` | Full credit | Admin |
| `submitted_for_verification` | `verification_required` | Part credit, or `manual_payment_review` | Admin |
| `submitted_for_verification` | `failed` | `GUARD_RETRY` | Admin |
| `submitted_for_verification` | `cancelled` | Order cancelled, never automatic | Admin |
| `verification_required` | `paid` | Rule 3 | Admin |
| `verification_required` | `refunded` | Rule 2 | Admin |
| `verification_required` | `failed` | `GUARD_RETRY` | Admin |
| `verification_required` | `cancelled` | A, B and C all 0, no open flags, order cancelled or expired | Admin |
| `failed` | `submitted_for_verification` | Reference while submission is open | Customer |
| `failed` | `paid` | Full credit | Admin |
| `failed` | `verification_required` | Part credit, or `manual_payment_review` | Admin |
| `failed` | `cancelled` | Expired or cancelled | System or admin |
| `cancelled` | `paid` | Late full credit | Admin |
| `cancelled` | `verification_required` | Late part credit | Admin |
| `paid` | `verification_required` | Rule 1, 4 or 5 | Admin |
| `paid` | `refunded` | Rule 2 | Admin |
| `refunded` | `paid` or `verification_required` | Refund returned or corrected, or a bank reversal, by the rules | Admin |

### Order transitions

| From | To | Requires | Stock |
|---|---|---|---|
| `pending_payment` | `payment_verification` | Reference, credit, or `manual_payment_review` | Stays held |
| `pending_payment` | `expired` | `GUARD_EXPIRY` | Released |
| `pending_payment` | `cancelled` | Admin, reason | Released |
| `payment_verification` | `pending_payment` | `GUARD_RETRY`, through `mark_payment_failed` only | Stays held |
| `payment_verification` | `confirmed` | `guard_confirm` | Stays held |
| `payment_verification` | `cancelled` | Admin, reason, refund due if money retained | Released |
| `expired` | `payment_verification` | `guard_reinstate`, through `reinstate_expired_order` only | Re-reserved |
| `confirmed` | `processing` | `guard_process` | Stays held |
| `confirmed`, `processing` | `cancelled` | Admin, reason, refund due if money retained | Released |
| `processing` | `shipped` | `guard_dispatch`, shipment recorded | Permanently reduced |
| `shipped` | `delivered` | Delivery recorded | None |
| `shipped` | `returned` | RTO parcel physically received | Added back only after inspection |

**`cancelled` can never be reinstated.** `delivered` and `returned` are final, and `expired` can only be reinstated. **No accounting event moves an order backward.** `confirmed → cancelled` and later moves are operational decisions, never accounting effects. **`paid` never automatically means `confirmed`:** recording money and confirming are separate transactions, with no linking trigger.

### Payment recording and confirmation

**`record_verified_payment`** always commits valid money, whatever the stock position: check admin, AAL2 and active session, lock the order, validate the amount and the UTR entered from the bank record, insert receipt and event, mark any linked submission matched, recalculate and derive status, move `pending_payment` to `payment_verification`, set flags, write history and audit, commit. **Expired or cancelled orders don't change status.** The customer's reference never pre-fills the verified UTR, and the screen warns if they differ.

**`confirm_order`** is a separate call, accepting only `paid` + `payment_verification`: check authorisation, lock the order then variants ascending, check `guard_confirm` and that the hold exists, set `confirmed`, write history and audit. **If stock is unavailable, it opens `stock_unavailable`, changes no status, and the money stays recorded.** An admin button may call one then the other. A failure in the second never undoes the first.

**Both verification paths use the same function and rules:** a customer-submitted reference, or an admin spotting the credit without one.

### Refusal evidence

An audit row inside a transaction that rolls back is lost, so evidence of a refusal never depends on one.

| Refusal | How evidence survives |
|---|---|
| **Expected refusal,** such as a stale fingerprint or a refused correction | The function checks **before any business write**, writes one `audit_logs` row with action `refused:<operation>`, and **returns a refusal result without raising**. So that row commits, and nothing else changed. |
| **Unexpected failure,** such as a trigger error, constraint, lock timeout or deadlock | The whole transaction rolls back, including its audit rows. **The server action then calls `record_refused_attempt` in a new, separate transaction**, with the operation name, order ID, SQLSTATE and correlation ID only. |
| **If that call also fails** | The server writes a structured log with the same fields and no personal data. It's reported as lost database evidence, not treated as recorded. |

`record_refused_attempt` writes only `audit_logs`, accepts allow-listed operation names and no free text, and changes no business data.

### Cancellation

`cancel_order(order, expected_fingerprint, expected_submission_version, reason)`:

1. Check admin, AAL2 and active session.
2. Lock the order, then variants ascending. If it's already cancelled, return success with no change.
3. Compare the fingerprint and submission version. Any mismatch refuses, and requires a refresh.
4. Mark open submissions `superseded`.
5. Release each hold exactly once, with one `release` movement per line.
6. Set `cancelled`. Payment becomes `cancelled` only if no money was ever recorded.
7. Create a `due` refund if money is retained.
8. **Open flags stay open.** Cancellation resolves nothing, and they block closure.
9. Write history and audit, then commit.

Admin cancellation with an open `manual_operational_review` is **awaiting owner approval**. Shipped orders can't be cancelled, only returned.

### Expired orders

**`reinstate_expired_order`** is separate from confirmation and moves `expired → payment_verification`. Then `confirm_order` confirms.

1. Check admin, AAL2 and active session.
2. Lock the order. Return success with no change only if `reinstated_at` is set **and** the status is no longer `expired`. An order that has expired again proceeds normally, and the earlier reinstatement stays in the audit history.
3. Check `guard_reinstate`.
4. Lock variants ascending, and check every line. If any falls short, reserve nothing, open `stock_unavailable`, and stay `expired`.
5. Increase `stock_held`, with one `hold` movement per line, reason `reinstatement`.
6. Set `payment_verification`, and set or overwrite `reinstated_at` and `reinstated_by`, write history and audit.

**`late_payment` must be resolved first (owner decision, 7 November 2026).** Reinstatement resolves no flag. A cancelled order can never use this.

**Late credit on a cancelled order:** recorded normally. Payment becomes `paid` or `verification_required`, the order **stays `cancelled`**, no stock moves, `late_payment` opens, and a `due` refund is created. If the customer still wants the product, a new linked order is placed, and money doesn't transfer.

## Review flags

**order_review_flags**: `id`, `order_id`, `reason`, `category`, `status` (`open`, `resolved`), `opened_source` (`system`, `admin`), `opened_by`, `triggering_actor_id`, `opened_at`, `detail`, `occurrence_count`, `last_seen_at`, `related_event_id`, `related_submission_id`, `resolved_by`, `resolved_at`, `resolution_code`, `resolution_note`.

- Partial unique index on `(order_id, reason) WHERE status = 'open'`, and `UNIQUE (id, order_id)`.
- `(related_event_id, order_id)` and `(related_submission_id, order_id)` are composite keys to their parents.
- `manual_*` reasons are admin-opened and all others system-opened. `opened_by` is required for admin and null for system.
- Resolution fields are all null while open and all required when resolved.
- Only `open → resolved`, once. **Resolved rows are immutable, and deletes are blocked.** A recurrence after resolution creates a new row.

**Recurrence:** every flag action locks the order first. Opening uses an insert with conflict handling on the partial index: a new flag gets count 1, and an existing one is locked by the conflict handling, with `occurrence_count` and `last_seen_at` updated. An append-only audit entry is written each time, in the same transaction.

**Resolution:** `resolve_review_flag(flag_id, resolution_code, note, expected_occurrence_count)` takes exactly one flag, needs admin, AAL2 and active session, and is refused if the count changed since the screen loaded. **Resolving one flag never resolves another.** No system process, cancellation or confirmation resolves a flag. Resolving changes no status.

### Flag registry: 15 flags

"Yes" means the flag blocks that action.

| Flag | Category | Retry | Confirm | Process | Reinstate | Dispatch | Expiry | Closure |
|---|---|---|---|---|---|---|---|---|
| `manual_payment_review` | Payment | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `amount_mismatch` | Payment | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `bank_reversal` | Payment | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `entry_corrected` | Payment | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `refund_returned` | Payment | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `pre_dispatch_refund` | Payment | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `financial_loss_review` | Financial loss | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `post_closure_activity` | Workflow | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `late_payment` | Late | Yes | No | No | Yes | Yes | Yes | Yes |
| `overpayment` | Payment | Yes | No | No | No | Yes | Yes | Yes |
| `stock_unavailable` | Stock | Yes | No | No | No | Yes | Yes | Yes |
| `late_reference` | Late | Yes | No | No | No | Yes | Yes | Yes |
| `duplicate_reference` | Duplicate | Yes | No | No | No | Yes | Yes | Yes |
| `old_submission` | Workflow | Yes | No | No | No | Yes | Yes | Yes |
| `manual_operational_review` | Operational | **No** | No | No | No | Yes | Yes | Yes |
| **Count** | | **14** | **8** | **8** | **9** | **15** | **15** | **15** |

`review_flag_blocks(reason, action)` is the single source, and it raises an error on an unknown value.

**Only `manual_payment_review` changes a status by itself:** `pending`, `submitted_for_verification` or `failed` become `verification_required`, and `pending_payment` becomes `payment_verification`. Every other status effect comes from the ledger rules.

**On `pending_payment`, the only flag that can remain open is `manual_operational_review`.** `late_reference` can open only on `expired` or `cancelled`. So a customer's late reference can never hold stock.

**When `pre_dispatch_refund` opens:** a refund before dispatch that leaves Net customer funds retained below the order total. Payment status doesn't change. Refunding only an overpayment doesn't open it.

**Extra resolution conditions:** `financial_loss_review` is refused while B > A. `overpayment` needs the excess refund recorded, or a decision with a reason. `late_payment` on a cancelled order needs no refund still `due`. `entry_corrected` needs a statement-check note.

## Guards

All run under the order lock.

| Guard | Requires |
|---|---|
| **`guard_confirm`** | `paid` + `payment_verification`, **C = 0**, no confirmation-blocking flag, stock secured |
| **`guard_process`** | `paid` + `confirmed`, **C = 0**, no processing-blocking flag |
| **`guard_dispatch`** | `paid` + `processing`, **C = 0**, no open flag, shipment recorded |
| **`guard_reinstate`** | `expired`, `paid`, retained covers the total, **C = 0**, no reinstatement-blocking flag |
| **`GUARD_RETRY`** | Order `payment_verification`, payment `submitted_for_verification` or `verification_required`, **zero active receipts of any kind**, A, B and C all 0, no submission in `submitted`, no retry-blocking flag, admin, AAL2, active session, reason |
| **`GUARD_EXPIRY`** | Order `pending_payment`, payment `pending` or `failed`, `now >= submission_deadline`, zero active receipts, C = 0, no submission in `submitted`, **no open flag of any reason** |
| **`guard_close`** | Order `delivered`, `cancelled`, `expired` or `returned`, C = 0, B not above A, payment not `verification_required`, no open flags, submissions or returns, admin action. **On `cancelled`, `expired` and `returned`, Net customer funds retained must also be 0.** |

**The zero-liability rule (owner decision, 7 November 2026)** is separate from flag membership. Any `due` refund, including an overpayment refund, stops confirmation, processing and dispatch until it's completed or cancelled. A customer who overpaid by ₹50 waits while the admin sends ₹50, if that refund is created first.

**Closure and retained money:** a `cancelled` or `expired` order can't close while Net customer funds retained are above 0. A `returned` order can't close until retained funds and refund liability are both 0. No deduction rule is introduced: whether any deduction is allowed is a CA question, and until it's answered, an order with retained funds stays open.

**`overpayment` and reinstatement:** with `late_payment` resolved and C = 0, an open `overpayment` flag doesn't stop reinstatement, but it does stop dispatch. **This is awaiting owner approval.**

### Retry guard cases

| Situation | Allowed? |
|---|---|
| No receipt ever, reference rejected | Yes |
| Reference still `submitted` | No |
| Partial or full verified credit | **No, never** |
| Credit corrected `entered_in_error`, flag resolved | Yes |
| Credit corrected with a replacement on this order | No |
| Credit moved by `wrong_order`, flag resolved | Yes |
| Credit genuinely reversed by the bank | **No**, both receipts stay active |
| Refund sent or returned | No |

Rejecting all submissions never moves an order by itself. `mark_payment_failed` is an explicit action, which increases `payment_failure_count`.

## Deadlines and stock

| Field | Meaning | Nullable | Created by | Changed by |
|---|---|---|---|---|
| `hold_expires_at` | Original deadline: placement + 2 hours | No | `create_order` | **Nothing** |
| `retry_expires_at` | The one retry: first failure + 2 hours | Yes | First `mark_payment_failed` | **Nothing** |
| `submission_grace_until` | Fixed grace from an explicitly approved operational hold | Yes | `grant_submission_grace` | `extend_submission_grace` only |

- **`base_deadline`:** `retry_expires_at` once `payment_failure_count` is 1, otherwise `hold_expires_at`.
- **`submission_deadline`:** closed once the count is 2 or more. Otherwise the later of `base_deadline` and any grace.
- **`submission_open`:** `pending_payment`, payment `pending` or `failed`, `now < submission_deadline`, fewer than 3 references. `GUARD_EXPIRY` uses the same deadline.

**Grace is granted only by an admin, with a reason.** It needs `pending_payment`, `manual_operational_review` open, a count below 2, and no existing grace. Value: base deadline + 24 hours. It's refused, never clamped, if it exceeds `hold_expires_at + 72 hours`. Resolving the flag doesn't remove it, so it runs to its fixed time. **`extend_submission_grace`** adds requested hours to the current deadline, under the same cap, and is forbidden after a second failure. **An extension never creates a payment retry.** The 24-hour grace and 72-hour cap are awaiting owner approval.

| Moment | Stock |
|---|---|
| Browsing, cart, opening checkout or WhatsApp | No effect |
| Order saved | Held. 2-hour provisional window. |
| Reference submitted within the window | **No automatic release.** Admin alerted after 24 hours. |
| First failure | One new 2-hour window, and the protection ends |
| Second failure | No new window. Expires at the next sweep unless a flag blocks it. |
| Any open flag on an expirable order | No automatic release |
| `paid`, not confirmed | Never auto-released |
| Late payment after expiry | Recorded. Reinstated only if stock can be reserved, otherwise flagged. |
| `shipped` | On-hand and held both reduced |
| Cancelled or expired | Released, with a `release` movement, once |

**Retry example, on-hand 5:**

| Time | Event | Payment | Order | Deadline | Held |
|---|---|---|---|---|---|
| 10:00 | Saved | `pending` | `pending_payment` | 12:00 | 1 |
| 10:30 | First reference | `submitted_for_verification` | `payment_verification` | Not applied | 1 |
| 15:00 | First failure | `failed` | `pending_payment` | 17:00 | 1 |
| 16:00 | Second reference | `submitted_for_verification` | `payment_verification` | Not applied | 1 |
| 18:00 | Second failure | `failed` | `pending_payment` | Closed | 1 |
| 18:15 | Sweep | `cancelled` | `expired` | None | 0 |

**Abuse limits (provisional):** 3 references per order, and 2 open unpaid orders per normalised phone, with nothing collected. Phones are India only in V1: strip symbols, remove `+91`, `91` or a leading `0`, require 10 digits starting 6–9, stored as `+91XXXXXXXXXX`. IP limits use a salted hash, for example 5 orders an hour and 20 a day. An admin with AAL2 can grant a temporary audited override for one phone. OTP is out of scope.

## Event matrix

Order status doesn't change in any row of this section, and payment after is always `derive_payment_status`.

| Event | Accounting | Flags, in every case |
|---|---|---|
| **Bank reversal** | A falls | `bank_reversal`, plus `financial_loss_review` if B > A |
| **Refund returned** | B falls, C rises | `refund_returned`, plus `financial_loss_review` if B still exceeds A |
| **Entry correction** | Corrected entries leave, replacements enter | `entry_corrected`, plus `financial_loss_review` if B > A |

| Order | Stock | Confirm | Process | Dispatch | Reinstate | Closure |
|---|---|---|---|---|---|---|
| `payment_verification` | Held | Blocked | Not applicable | Not applicable | Not applicable | Not applicable |
| `confirmed` | Held | Done | Blocked | Blocked later | Not applicable | Not applicable |
| `processing` | Held | Done | Done | Blocked | Not applicable | Not applicable |
| `shipped` | Already reduced | Done | Done | Done | Not applicable | Not applicable |
| `delivered` | None | Done | Done | Done | Not applicable | Blocked |
| `returned` | Inspection only | Done | Done | Done | Not applicable | Blocked |
| `expired` | None | Refused | Not applicable | Not applicable | Blocked | Blocked |
| `cancelled` | None | Refused | Refused | Refused | Never | Blocked |

**Loss after a reversal:** ₹1,000 credit, ₹1,000 refund sent, then the credit is reversed gives A = 0, B = 1,000, C = 0, retained -1,000, and `verification_required`, with `bank_reversal` and `financial_loss_review`. The order status doesn't change. `financial_loss_review` can't be resolved while B > A, so the order can't close. **V1 has no write-off, settled status or new accounting event.** Only real recovered money, a genuine bank-returned refund or a proven entry correction clears it. Anything else needs CA advice, then a separately approved design.

## Closure

`closed_at` is an audit and retention marker only. These are separate: operational status, financial obligations, open review cases, and closure. Only `close_order` sets it, and a closed order can never have an open flag.

**Clearing `closed_at` is a financial and audit reopening, never an operational one.** One transaction: authorise, lock the order, record the event with its normal function, raise the version, recalculate, clear `closed_at` with a `closure_reopened` audit entry, open `post_closure_activity` and the event's own flag, create any `due` refund, commit. Any failure rolls back everything.

Cancelled stays cancelled, delivered stays delivered, returned stays returned, and expired stays expired unless the guarded reinstatement is used. A late reference never creates confirmation or dispatch permission. Closing again runs `guard_close`, and the retention clock restarts.

## Operations

**stock_movements** (append-only): `id`, `variant_id`, `order_id` (nullable), `type`, `on_hand_change`, `held_change`, `reason`, `created_by`.

**Stock reconciliation:** for every variant, `stock_on_hand = opening_stock + sum(on_hand_change)` and `stock_held = sum(held_change)`. `opening_stock` is set when the variant is created and never changes. Admin variant creation doesn't set it, so new variants start at 0 and stock enters through a `purchase` movement. A non-zero value is only for a reviewed migration of existing stock.

**A deferred check at commit** refuses any transaction where a variant's change in `stock_on_hand` or `stock_held` doesn't equal that transaction's movements for that variant. An admin reconciliation check and tests apply the full formula.

A check constraint enforces: `order_id` is null only for `adjustment` and `purchase` (**owner decision, 7 November 2026**), and required for `hold`, `release`, `dispatch`, `return` and `write_off`. Every other child table has `order_id NOT NULL`, and the write guard rejects a null with `NV108`.

**notifications** (outbox): `id`, `order_id` (nullable), `dedupe_key` (required, globally unique), `channel` (`email`, later `whatsapp`, `sms`), `template`, `recipient`, `status`, `attempts`, `next_attempt_at`, `lease_until`, `provider_id`, `last_error`, `sent_at`. Digest keys are `digest:operational_holds:<recipient hash>:<IST date>`, with a null order. Order keys are `order:<order id>:<template>`, with an order required.

| State | Meaning | Next |
|---|---|---|
| `queued` | Committed, not attempted | Claimed with `FOR UPDATE SKIP LOCKED` |
| `sending` | Claimed under a lease, committed before the provider call | Result recorded, or lease expires |
| `sent` | Provider accepted | Final. Doesn't prove inbox delivery. |
| `failed_retryable` | Clear failure, no acceptance | Retried with backoff |
| `delivery_unknown` | Timeout or expired lease | No automatic resend unless provider idempotency is verified. Shown in admin. |
| `failed_final` | Permanent | Manual retry from admin |

**No exactly-once delivery is claimed.** A failed email never fails an order.

**Order notifications are queued inside the order's own transaction** (decided 7 November 2026): `create_order` queues `order_received` (see Checkout). The unique `dedupe_key` allows one row per order and template, so a retry can't queue a second email. `notifications` isn't covered by the order write lock, because it's an outbox, not order state. Its writes stay restricted: only `ledger_owner` inserts, through `create_order` and later named functions, and no application role has direct table rights.

**audit_logs** (append-only): `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `correlation_id`, `before` (jsonb), `after` (jsonb), `created_at`.
Written by database functions or triggers for every order status change, payment, reversal, refund, return, shipment, correction, flag, price change, stock adjustment and settings change.

`before` and `after` use a **per-table allow-list of columns**. They never contain customer names, phones, emails, addresses, `public_token`, `write_lock_tx`, UTRs in customer submissions, or proof paths. Those are referenced by entity ID.

**store_settings**: single row with `whatsapp_number`, `upi_id`, `upi_payee_name`, `upi_qr_payload`, `upi_qr_payload_hash`, `upi_qr_classification`, `upi_qr_verified_at`, `dynamic_amount_enabled` (default `false`), `shipping_flat_paise`, `free_shipping_threshold_paise`, `payment_window_hours` (2), `verification_alert_hours` (24), `operational_grace_hours` (24), and the seller and grievance details shown on the site.

**profiles**: `id` → `auth.users` (`ON DELETE RESTRICT`), `full_name`, `email`, `avatar_url`, `phone`, `role` (`customer`, `admin`, default `customer`), `created_at`, `updated_at`. A trigger creates the row at signup and always sets `customer`. Users can't change their own `role`, and signup metadata is never used to set it. The admin role is granted by hand with SQL.
- **Built ahead of C1 (8 Nov 2026, owner's approval):** draft migration `store/supabase/migrations/20261108200000_customer_profiles.sql`, run only on disposable local stacks, with pgTAP tests in `store/supabase/tests/profiles_test.sql`. C1 builds on it; the `ledger_owner` grants and admin read in the privileges table below are added there.
- `email` is a copy of the sign-in email, kept in step by a trigger on `auth.users`. `avatar_url` is Google's profile picture, accepted only from `https://lhN.googleusercontent.com/`. `phone` is optional, 10 digits starting 6–9, collected later at checkout.
- One auth user per email: Google and email sign-ins for the same verified address are linked by Supabase, so there's one profile.

**rate_limits**: `key_hash`, `window_start`, `count`, `override_until`, `override_reason`, `override_by`. Writable only through functions.

Append-only means `update`, `delete` and `truncate` are blocked by triggers and permissions for every application role. It covers `stock_movements`, `order_status_history`, `payment_status_history`, `order_cancellations`, `order_items`, `payment_receipts`, `payment_events`, `proof_access_log` and `audit_logs`.

## Checkout

`create_order` runs in one transaction:

1. Validate the input. The browser sends only variant IDs and quantities.
2. Look up the idempotency key. The same key and payload returns the existing order, and the same key with a different payload is rejected.
3. Take the per-phone lock, and check the open-order limit.
4. Lock variants in ascending ID order, with `lock_timeout` set.
5. Check `stock_on_hand - stock_held >= quantity` for every line. If any fails, nothing is saved.
6. Read prices and tax details from the database.
7. Insert the order with `write_lock_tx = NULL`, handling a conflict on `idempotency_key`. If another transaction won the same key, compare `idempotency_hash`: a match returns that order, and a difference is rejected. Nothing else is written.
8. Call the lock helper, which locks and stamps the new order.
9. Write snapshots and hold movements, and increase `stock_held`.
10. Insert one `notifications` row: template `order_received`, `dedupe_key` `order:<order id>:order_received`, status `queued`, ignoring a conflict on `dedupe_key`. It's part of the same transaction, so it exists only if the order does.

Email is sent only after commit, by the sender claiming queued rows. An idempotent retry that returns an existing order writes nothing, so it queues no second email. A sending failure never changes the order.

## Locking and roles (working design, subject to testing)

The three-role write-lock design is the **working design (owner decision, 7 November 2026), subject to actual PostgreSQL testing**. Nothing here has been verified. If hosted testing rules it out, a fallback with weaker claims will be reported.

| Role | Owns | Rights |
|---|---|---|
| `ledger_schema_owner` | Tables, indexes, triggers, trigger functions | Full, as owner. Used only by migrations. |
| `ledger_owner` | Writer functions | DML grants listed below, no ownership, can't disable triggers |
| `lock_owner` | Only `private.lock_orders_for_write` | `SELECT (id, write_lock_tx)` and `UPDATE (write_lock_tx)` on `orders`, nothing else |

All are `NOLOGIN`, with no special attributes, and no application role is a member. RLS policies scoped only to `lock_owner` and `ledger_owner` let those non-owner roles work, without widening columns or commands.

**Why a stamp:** PostgreSQL row locks generally aren't visible in `pg_locks`, and an advisory lock doesn't prove a row lock. On `UPDATE`, PostgreSQL is understood to lock the child row before the BEFORE trigger runs, so a trigger can't guarantee parent-first by acquiring a lock. So the design proves a **write**: if this transaction updated the parent, it holds a row lock on it.

**`private.lock_orders_for_write(order_ids)`:**
1. Reads this transaction's stamped orders. If an unstamped requested ID is lower than the highest stamped, it raises `NV102` before locking.
2. For each new ID, ascending: `SELECT ... FOR UPDATE`, then sets `write_lock_tx = pg_current_xact_id()`.

Writers call it first, once, with all IDs. It's `SECURITY DEFINER` with an empty `search_path`, and `EXECUTE` only for `ledger_owner`.

| Trigger | Rule | Error |
|---|---|---|
| `orders` BEFORE INSERT | Stamp must be null | `NV103` |
| `orders` BEFORE UPDATE, stamp | Only `lock_owner`, and only to this transaction, with no other column change. `ledger_schema_owner` may clear stamps for restore. | `NV103` |
| `orders` BEFORE UPDATE, other columns | Row must carry this transaction's stamp | `NV101` |
| Child BEFORE INSERT or UPDATE | `current_user = 'ledger_owner'`, parent stamped by this transaction, order not null | `NV104`, `NV101`, `NV108` |
| Child `order_id` | Immutable | `NV105` |
| Append-only tables | No update or delete | `NV106` |

**What this doesn't prove:** that `SELECT ... FOR UPDATE` ran, or that two orders were locked ascending. Those rely on the helper, its `NV102` check, a catalogue scan and tests. Deferred triggers run at commit, so they're `SECURITY DEFINER`. Stamp-only updates don't raise a version, audit entry, `updated_at` or status history.

**Lock order:** rate-limit rows and phone lock, orders ascending, reference, flag, receipt, refund, submission and return rows, then variants ascending. **`create_order` is a documented exception:** it takes variants before its new order row, which nobody else can see, and it never locks an existing order. `run_expiry_sweep` handles one order per transaction, because locking variants across orders could deadlock.

**Deadlock freedom isn't claimed.** If one occurs, `40P01` rolls back one transaction entirely.

### Trigger inventory

Planned, not yet built or tested. Trigger functions are owned by `ledger_schema_owner`. Deferred triggers fire at commit, outside the writer function, so they must be definers. Invoker functions read `current_user`.

| Trigger | On | Timing | Runs as | Purpose |
|---|---|---|---|---|
| `orders_guard` | `orders` | BEFORE INSERT, UPDATE | Invoker | Stamp rules and stamp requirement |
| Child write guard | `order_items`, status history tables, `order_cancellations`, `payment_submissions`, `shipments`, `returns`, `return_items`, `refunds`, `payment_receipts`, `payment_events`, `payment_proofs`, `proof_access_log`, `order_review_flags` | BEFORE INSERT, UPDATE | Invoker | Writer check, parent stamp, null and immutable `order_id` |
| Stock movement guard | `stock_movements` | BEFORE INSERT | Invoker | Writer check, stamp if `order_id` is set, allowed null types |
| Append-only guard | All append-only tables | BEFORE UPDATE, DELETE, TRUNCATE | Invoker | Refuses changes |
| Order and payment status machine | `orders` | BEFORE UPDATE OF status columns | Invoker | Allowed moves from the transition tables, with guards recalculated from the ledger |
| Refund, return, submission, flag and shipment status machines | Each table | BEFORE INSERT, UPDATE OF status | Invoker | Allowed moves and starting states |
| Deadline guard | `orders` | BEFORE UPDATE | Invoker | Write-once `retry_expires_at`, immutable `hold_expires_at`, grace rules and cap |
| Variant guard | `product_variants` | BEFORE UPDATE | Invoker | Immutable `opening_stock`, stock within limits |
| Reference generation | `payment_receipts` | BEFORE INSERT | Invoker | Computes and validates generation |
| Ledger shape | `payment_receipts`, `payment_events` | BEFORE INSERT | Invoker | Kind, type, direction, amount and link rules, and the reversal cap |
| Refund receipt rule | `payment_receipts` | BEFORE INSERT | Invoker | One active receipt per kind per refund |
| Flag rules | `order_review_flags` | BEFORE INSERT, UPDATE | Invoker | Source rules, immutability, `late_reference` eligibility |
| `updated_at` | Tables with that column | BEFORE UPDATE OF business columns | Invoker | Skipped on stamp-only updates |
| Status history | `orders` | AFTER UPDATE OF status columns | Invoker | Writes order and payment history |
| Audit writer | `orders`, ledger, refund, return, shipment, flag, settings, variant and catalogue tables | AFTER INSERT, UPDATE | **Definer** | Allow-listed audit rows, including when fired by `authenticated` catalogue writes |
| Financial and submission version | `payment_receipts`, `payment_events`, `refunds`, `payment_submissions` | AFTER INSERT, UPDATE OF status | **Definer** | Raises the version |
| Pair check | `orders` | Deferred | **Definer** | Allowed status pairs, and the `pending_payment` flag rule |
| Ledger match | `orders`, `payment_events`, `refunds` | Deferred | **Definer** | Cached totals and stored status match the ledger |
| Receipt and event check | `payment_receipts` | Deferred | **Definer** | Every receipt has its event |
| Replacement check | `payment_events` | Deferred | **Definer** | Correction and replacement rules, both sides |
| Stock match | `product_variants` | Deferred | **Definer** | Stock changes equal that transaction's movements |
| Reinstatement check | `orders` | Deferred | **Definer** | `expired → payment_verification` needs `paid` and matching `hold` movements |
| Closure check | `orders`, `order_review_flags` | Deferred | **Definer** | No open flag on a closed order |
| Signup | `auth.users` | AFTER INSERT | **Definer** | Creates a `customer` profile. Hosted rights to be tested. |

`notifications` has no write guard: it isn't covered by the order write lock (decided 7 November 2026). Its writes are restricted by grants and deduplicated by `dedupe_key` instead (see Operations).

### Indexes

All foreign keys are indexed. These are needed beyond that. Whether `xid8` indexes work as planned is to be tested.

| Index | Serves |
|---|---|
| `orders (write_lock_tx)` | The lock helper's check |
| `orders (hold_expires_at) WHERE status = 'pending_payment'` | Expiry candidates |
| `orders (customer_phone_normalised) WHERE status IN ('pending_payment', 'payment_verification')` | Open-order limit |
| `orders (status, created_at)` | Admin order list |
| `payment_submissions (reference_normalised)` | Duplicate detection |
| `payment_submissions (order_id) WHERE status = 'submitted'` | Open submission checks |
| `order_review_flags (order_id, reason) WHERE status = 'open'` | Guards, and the unique rule |
| `refunds (order_id) WHERE status = 'due'` | Liability |
| `payment_events (order_id, created_at)` | Ledger totals |
| `stock_movements (variant_id, created_at)` | Reconciliation |
| `notifications (status, next_attempt_at)` | Claiming work |

### Versions

| Field | Rises on |
|---|---|
| `financial_version` | Every receipt or event insert, and every refund insert or status change, through a trigger, including corrections, reversals, returns, voids and both orders in `wrong_order` |
| `submission_version` | Every submission insert and status change |

Neither rises on flags, shipments, stock or order status alone. `cancel_order` takes a fingerprint (SHA-256 of `financial_version`, Collected, Refunded, Liability and the latest event ID) and `expected_submission_version`, and recalculates from the ledger under the lock. Any mismatch refuses and requires a refresh.

### Same-order keys

Composite foreign keys keep related rows on one order:

| Child | Key | Parent |
|---|---|---|
| `payment_events` | `(corrects_event_id, order_id)` | `payment_events (id, order_id)` |
| `payment_events` | `(receipt_id, order_id)` | `payment_receipts (id, order_id)` |
| `payment_receipts` | `(reverses_receipt_id, order_id)` | `payment_receipts (id, order_id)` |
| `payment_receipts` | `(refund_id, order_id)` | `refunds (id, order_id)` |
| `payment_receipts` | `(submission_id, order_id)` | `payment_submissions (id, order_id)` |
| `refunds` | `(retry_of, order_id)` | `refunds (id, order_id)` |
| `refunds` | `(return_id, order_id)` | `returns (id, order_id)` (C2) |
| `returns` | `(shipment_id, order_id)` | `shipments (id, order_id)` |
| `return_items` | `(return_id, order_id)` | `returns (id, order_id)` |
| `return_items` | `(order_item_id, order_id)` | `order_items (id, order_id)` |
| `payment_proofs` | `(submission_id, order_id)` | `payment_submissions (id, order_id)` |
| `proof_access_log` | `(proof_id, order_id)` | `payment_proofs (id, order_id)` |
| `order_review_flags` | `(related_event_id, order_id)` | `payment_events (id, order_id)` |
| `order_review_flags` | `(related_submission_id, order_id)` | `payment_submissions (id, order_id)` |

`UNIQUE (id, order_id)` is required on each parent: `order_items`, `payment_submissions`, `shipments`, `returns`, `refunds`, `payment_receipts`, `payment_events` and `payment_proofs`.

`payment_events.replaces_event_id` is a plain unique key, restricted by a trigger, because `wrong_order` must cross orders.

## Database functions

All are planned, none exists. `SECURITY DEFINER` functions use an empty `search_path`, with `EXECUTE` revoked from `PUBLIC`, `anon`, and any role not listed.

| Called by | Owner | Functions |
|---|---|---|
| **Service module** (`service_role`) | `ledger_owner` | `create_order`, `get_order_by_token`, `submit_payment_reference`, `issue_proof_upload`, `finalize_proof`, `rate_limit_hit` |
| **Admin with AAL2** (`authenticated`, checked inside) | `ledger_owner` | `record_verified_payment`, `record_bank_reversal`, `record_entry_correction`, `create_refund`, `cancel_refund`, `complete_refund`, `record_refund_returned`, `confirm_order`, `reinstate_expired_order`, `cancel_order`, `mark_payment_failed`, `mark_payment_cancelled`, `reject_submission`, `close_order`, `open_review_flag`, `resolve_review_flag`, `open_cross_order_review`, `grant_submission_grace`, `extend_submission_grace`, `run_expiry_sweep`, `record_dispatch`, `record_delivery`, `record_rto_started`, `record_rto_received`, `correct_shipment_details`, `open_return`, `inspect_return`, `link_related_orders`, `adjust_stock`, `update_store_settings`, `set_upi_qr`, `review_proof`, `issue_proof_view`, `admin_get_costs`, `admin_set_cost`, `grant_order_limit_override` |
| **Refusal evidence** (`authenticated` with an admin check, and `service_role`) | `ledger_owner` | `record_refused_attempt`, which writes only allow-listed fields to `audit_logs` |
| **Authorisation** (`authenticated`, read only) | `ledger_owner` | `is_admin`, `require_admin_session` |
| **Internal, no app-role access** | `lock_owner`, `ledger_owner` or `ledger_schema_owner` | `lock_orders_for_write`, flag opening, closure reopening, `handle_new_user`, version bumps, deferred checks, digest enqueue |
| **Not definer** | | `orders_guard`, `child_write_guard`, `append_only_guard`, `review_flag_blocks`, `derive_payment_status`, `guard_*`, `submission_deadline`, `base_deadline` |

No scheduler role exists until one is approved. Customers have no write functions at launch: own orders are read through limited views, and proof actions go through server code after an ownership check.

**Service functions must prove who they act for,** because the secret key can otherwise act for any order:

| Function | Required input, checked inside |
|---|---|
| `create_order` | `customer_id` only from a session the server verified, otherwise null for a guest. Never from the browser. |
| `get_order_by_token` | The order's `public_token` |
| `submit_payment_reference`, `issue_proof_upload`, `finalize_proof` | The order's `public_token`, or a `customer_id` the server verified that matches the order. A mismatch is refused. |

`require_admin_session()` runs at the start of every admin function and in restrictive RLS policies. It requires the admin role, `aal2` in the token, an active session row matching the token's `session_id`, a verified MFA factor and a user who isn't banned. Admin functions refuse the secret key, because they need a real user. See `SECURITY_PLAN.md`.

## Privileges

**`ledger_schema_owner` owns all 30 tables.** No role other than the owner has `DELETE`, `TRUNCATE`, `REFERENCES` or `TRIGGER`. **`service_role` has no table rights.** `anon` can read only active catalogue data and safe settings, through views and non-cost columns. `authenticated` rights are limited by RLS, and admin reads need AAL2 and an active session. This matrix must be regenerated from the real catalogue once migrations exist.

**Supabase's default privileges** grant `ALL` on tables, sequences and functions that `postgres` creates in `public` to `anon`, `authenticated` and `service_role` (seen in a local dump on 7 November 2026). Every migration must leave those roles with no rights beyond this matrix: default grants are revoked, privileges on each object are revoked explicitly, and the catalogue checks confirm it. The C1a plan avoids the defaults by creating objects as their owner role, subject to testing.

| Tables | `authenticated` | `ledger_owner` |
|---|---|---|
| `profiles` | Own row: read, update `full_name`, `phone`. Admin: read. | Select, insert |
| `categories`, `products`, `product_images`, `collections`, `collection_products`, `trending_picks` | Active: read. Admin: insert, update. | Select |
| `product_variants` | Active: read, no cost or stock. Admin: insert, update, excluding cost and stock. | Select, update `stock_on_hand`, `stock_held`, `cost_paise` |
| `store_settings` | Safe fields. Admin: read. | Select, update |
| `rate_limits` | None | Select, insert, update |
| `audit_logs`, `order_status_history`, `payment_status_history`, `order_cancellations`, `payment_receipts`, `payment_events`, `proof_access_log`, `stock_movements` | Admin: read | Select, insert |
| `orders` | Own: limited columns. Admin: read, without `write_lock_tx`. | Select. Insert all except stamp and versions. Update `status`, `payment_status`, `amount_received_paise`, `amount_refunded_paise`, `payment_failure_count`, `retry_expires_at`, `submission_grace_until`, `confirmed_at`, `shipped_at`, `delivered_at`, `closed_at`, `reinstated_at`, `reinstated_by`, `related_order_id`, `relation_type`, `updated_at`. |
| `order_items` | Own and admin: no cost | Select, insert |
| `order_transitions`, `payment_transitions` | None | Select |
| `payment_submissions` | Admin: read | Select, insert. Update `status`, `is_duplicate`, `reviewed_by`, `reviewed_at`, `superseded_at`, `superseded_by`. |
| `shipments` | Own: limited. Admin: read. | Select, insert. Update shipment status, courier, AWB, tracking, dates, reason, note. |
| `returns`, `return_items` | Own: limited. Admin: read. | Select, insert. Update status, `received_at`, inspection fields. |
| `refunds` | Own: limited. Admin: read. | Select, insert. Update `status`, `completed_at`, `cancelled_at`, `updated_at`. |
| `payment_proofs` | Admin: read | Select, insert. Update status, file, review, retention and legal-hold fields. |
| `notifications` | Admin: read | Select, insert. Update delivery fields. |
| `order_review_flags` | Admin: read | Select, insert. Update `status`, `occurrence_count`, `last_seen_at`, and resolution fields. |

## Admin reconciliation views

Read-only views for an admin with AAL2, derived from the ledger. They can't change anything, and corrections happen only through correction functions.

| View | Shows | Flags |
|---|---|---|
| References awaiting verification | Order, reference, age, duplicate marker | Old submissions |
| UPI receipts | UTR, amount, order, verifier | Overpayments, late payments |
| Exceptions | Open flags by reason and age | Loss reviews |
| Refunds due | Order, amount, reason, age | Blocked completion |
| Refunds completed | Amount, reference, date, verifier, linked return | Totals above collected |
| Stock held past deadline | Order, age, reason | Amber at 24 hours, red at 72 hours (awaiting approval) |

## Size estimate

An order with its items, logs and audit rows should take a few KB (estimate). Even at 5 KB each, 500 MB holds about 100,000 orders, well beyond the launch period. The upgrade trigger of 350 MB is in `PROJECT_ARCHITECTURE.md`.

## After launch (not V1)

| Tables | For |
|---|---|
| `addresses` | Saved customer addresses |
| `carts`, `cart_items` | Cart that follows a logged-in customer |
| `wishlists`, `wishlist_items` | Saved products |
| `reviews` | Rating, text, `order_item_id` for the Verified Purchase label, `status` for moderation |
| `coupons`, `coupon_redemptions` | Discounts, using the existing `discount_paise` |
| `banners` | Home page |
| `ai_conversations`, `ai_messages` | Assistant history |
| `shipment_events` | Courier tracking |
| `courier_settlements`, `courier_settlement_adjustments` | COD remittance reconciliation |

None of these require changing how orders work. Linking past guest orders to an account is also deferred. When built, it must require a verified matching email, because an unverified address would expose someone else's orders. Razorpay records use `payment_receipts` and `payment_events` with `verified_source = gateway`.

### Future COD design (not V1, not built)

Kept so the seams stay correct, and to be reviewed again before any COD work. It would add `cod` to `payment_method`, `cod_fee_paise` and an optional advance per order, and a settlement status.

- **Collection isn't money received.** A `courier_collected` event wouldn't raise Collected. Only a remittance seen in the bank would.
- **Settlements:** one remittance UTR could cover many orders, which needs multi-order allocation that V1 deliberately doesn't have. The balancing rule would be gross allocations minus debits plus credits equals the bank receipt, with each deduction identified, and anything that doesn't balance stays flagged.
- **Refunds** would wait for the remittance, subject to CA and legal review.

## Sample data

Only `supabase/seed.sql`, for local and dev use, holds sample products. Real products are added through `/admin`. No reviews are seeded, in any environment.
