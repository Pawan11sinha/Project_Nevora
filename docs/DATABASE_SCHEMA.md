# NÉVORA database schema

Status: plan approved on 5 November 2026. Nothing is built until after Phase 1a. Postgres on Supabase Free (500 MB).

Conventions: `uuid` primary keys unless noted, `timestamptz` for `created_at` and `updated_at`, and integer paise for money (columns end in `_paise`). All foreign keys are indexed.

**No image data is stored in the database or in Supabase Storage.** Tables hold only R2 object keys and metadata.

## Launch tables

### Catalogue

**categories**: `id`, `parent_id` → categories (nullable), `name`, `slug` (unique), `description`, `image_key`, `sort_order`, `is_active`.
New categories need no code changes.

**products**: `id`, `category_id` → categories, `name`, `slug` (unique), `description`, `material`, `care_instructions`, `dimensions`, `hsn_code`, `gst_rate_bps`, `status` (`draft`, `active`, `archived`), `is_featured`.
Full-text search index on name and description.

**product_variants**: `id`, `product_id` → products, `sku` (unique), `option_label` (for example "Silver" or "Default"), `price_paise` (> 0), `mrp_paise` (≥ price), `cost_paise` (admin only), `stock_on_hand` (≥ 0), `stock_held` (≥ 0), `low_stock_threshold`, `is_active`.
Every product has at least one variant. Price and stock live here. Available stock is `stock_on_hand - stock_held`, with a check that it can't go below zero.

**product_images**: `id`, `product_id` → products, `variant_id` (nullable), `r2_key_base`, `version`, `original_width`, `original_height`, `alt_text`, `sort_order`.
Files are stored in R2 as `<r2_key_base>-v<version>-<width>.webp`, with widths 400, 800 and 1600.

### Orders

**orders**:
- Identity: `id`, `order_number` (unique, from a sequence, for example `ORD-1001`), `public_token` (unique, random, used for the private order link), `idempotency_key` (unique).
- Customer: `customer_id` → profiles (null for guest orders), `customer_name`, `customer_phone`, `customer_email`, shipping address fields, `pincode`, `notes`.
- State: `status`, `payment_method`, `payment_status`.
- Amounts set at creation: `subtotal_paise`, `shipping_paise`, `discount_paise` (0 at launch), `total_paise`, `advance_required_paise` (a copy of the setting at order time, deducted from the total on delivery; 0 for UPI).
- Amounts maintained by `record_payment`: `amount_received_paise` (≥ 0).
- Calculated: `cod_balance_paise`, generated as `greatest(total_paise - amount_received_paise, 0)` for `cod`, and 0 for `upi`.
- Fulfilment: `hold_expires_at`, `courier_name`, `tracking_number`, `confirmed_at`, `shipped_at`, `delivered_at`.

Checks: `total_paise = subtotal_paise + shipping_paise - discount_paise`, and `advance_required_paise <= total_paise`.

**order_items**: `id`, `order_id` → orders, `variant_id` → product_variants, `product_name`, `variant_label`, `sku`, `unit_price_paise`, `quantity` (> 0), `line_total_paise`, `unit_cost_paise`.
Text and prices are snapshots. Variants that have been ordered can be archived but not deleted. `unit_cost_paise` is admin only: customers read their order items through a limited view that leaves it out.

**payments** (append-only): one row for each amount **the admin has verified in the bank or UPI account**.

| Column | Notes |
|---|---|
| `id`, `order_id` | |
| `kind` | `advance`, `full`, `part`, `cod_balance`, `refund`, `reversal` |
| `method` | `upi`, `cash`, later `razorpay` |
| `amount_paise` | Always > 0. `kind` sets the direction. |
| `reference` | UTR. Required for `upi`. |
| `verified_source` | `bank`, `upi_app`, `courier_remittance` or `cash`. Later `gateway`. |
| `verified_by` → profiles, `verified_at` | Required |
| `reversal_of` → payments | Set when correcting a mistake |
| `note`, `provider_data` (jsonb, for later) | |

Partial unique index on `reference` where present, so one bank transaction can't be claimed for two orders.

Customers can't create rows here. Screenshots and claims stay in WhatsApp and have no effect on payment status. Mistakes are fixed by adding a `reversal` row, never by editing.

### Status values

`order_status`:

| Status | Meaning | Stock |
|---|---|---|
| `awaiting_whatsapp_confirmation` | Saved, waiting for payment and owner check | Held |
| `confirmed` | Payment rule met, owner accepted | Held |
| `packed` | Ready to dispatch | Held |
| `shipped` | With courier | Removed from on-hand |
| `delivered` | Complete | None |
| `cancelled` | Cancelled before dispatch | Released |
| `expired` | Hold ran out with nothing received | Released |
| `returned` | Came back (refused or returned) | Added back only after inspection |

Allowed moves are enforced in the database:

```text
awaiting_whatsapp_confirmation -> confirmed | cancelled | expired
confirmed -> packed | cancelled
packed -> shipped | cancelled
shipped -> delivered | returned
delivered -> returned
```

`payment_method`: `upi`, `cod`.

`payment_status`, set only by `record_payment`:

| Status | UPI order | COD order |
|---|---|---|
| `unpaid` | Nothing received | Nothing received |
| `part_paid` | Received less than the total | Received less than the advance |
| `advance_received` | Not used | Received at least the advance, less than the total |
| `paid` | Received the total | Received the total |
| `refunded` | Fully refunded | Fully refunded |

An order can only become `confirmed` when `upi` is `paid`, or `cod` is `advance_received` or `paid`. Cancelling an order with money received requires a refund or a recorded decision by the admin.

### Operations

**stock_movements** (append-only): `id`, `variant_id`, `order_id` (nullable), `type` (`purchase`, `adjustment`, `hold`, `release`, `dispatch`, `return`), `on_hand_change`, `held_change`, `reason`, `created_by`.

**notifications**: `id`, `order_id`, `channel` (`email`, later `whatsapp`, `sms`), `template`, `recipient`, `status` (`pending`, `sent`, `failed`), `provider_id`, `error`, `sent_at`. Unique on order and template, so a retry can't send a duplicate. Quota errors from Resend are stored here.

**audit_logs** (append-only): `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `before` (jsonb), `after` (jsonb), `created_at`.
Written by database functions or triggers for every order status change, payment, reversal, refund, price change, stock adjustment and settings change.

**store_settings**: single row with `whatsapp_number`, `upi_id`, `upi_payee_name`, `upi_qr_key`, `shipping_flat_paise`, `free_shipping_threshold_paise`, `cod_enabled`, `cod_advance_paise` (≥ 0, editable in admin), `order_hold_hours`, and the seller and grievance details shown on the site.

**profiles**: `id` → `auth.users`, `full_name`, `phone`, `role` (`customer`, `admin`, default `customer`). A trigger creates the row at signup and always sets `customer`. Users can't change their own `role`, and signup metadata is never used to set it. The admin role is granted by hand with SQL.

**rate_limits**: `key_hash`, `window_start`, `count`. Used for checkout limits and writable only by the server.

Append-only means `update` and `delete` are blocked by triggers and permissions for every role, including admin.

## Database functions

| Function | Job |
|---|---|
| `create_order(items, customer, method, idempotency_key)` | Locks variants in a stable order so concurrent orders can't deadlock, checks stock, reads prices and settings, generates the order ID, writes the order, items and hold movements. The browser never sends prices. A repeat key returns the existing order. |
| `record_payment(order, kind, method, amount, reference, source, note)` | Admin only. Adds the row, updates `amount_received_paise` and `payment_status`, and writes the audit log. Rejects reused references. Overpayment is flagged for review. |
| `reverse_payment(payment, reason)` | Admin only. Adds a reversal and recalculates. |
| `set_order_status(order, status)` | Admin only. Enforces allowed moves and the payment rule, moves stock and writes the audit log. |
| `adjust_stock(variant, change, reason)` | Admin only. Changes on-hand stock and writes a movement. |
| `update_store_settings(changes)` | Admin only. Writes the audit log. |
| `expire_stale_orders()` | Scheduled hourly with `pg_cron`. Expires orders past `hold_expires_at` where `amount_received_paise = 0`, and releases stock. Anything with money received is left for manual review. |
| `is_admin()` | Reads the caller's role for RLS policies. |

## Size estimate

An order with its items, logs and audit rows should take a few KB (estimate). Even at 5 KB each, 500 MB holds about 100,000 orders, well beyond the launch period. The upgrade trigger of 350 MB is in `PROJECT_ARCHITECTURE.md`.

## Added after launch

| Tables | For |
|---|---|
| `addresses` | Saved customer addresses |
| `carts`, `cart_items` | Cart that follows a logged-in customer |
| `wishlists`, `wishlist_items` | Saved products |
| `reviews` | Rating, text, `order_item_id` for the Verified Purchase label, `status` for moderation |
| `coupons`, `coupon_redemptions` | Discounts, using the existing `discount_paise` |
| `banners`, `collections`, `collection_products` | Home page and curated edits |
| `ai_conversations`, `ai_messages` | Assistant history |

None of these require changing how orders work. Linking past guest orders to an account is also deferred. When built, it must require a verified matching email, because an unverified address would expose someone else's orders. Razorpay records use `payments` with `verified_source = gateway`.

## Sample data

Only `supabase/seed.sql`, for local and dev use, holds sample products. Real products are added through `/admin`. No reviews are seeded, in any environment.
