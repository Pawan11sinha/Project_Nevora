# NÉVORA: questions for CA and legal review

Status: updated on 7 November 2026 for review. **Nothing here is a conclusion or legal advice.** Provisional values are planning assumptions until a CA or lawyer confirms them. The store isn't live, and no real customer, payment or order data exists yet.

## The business in brief

NÉVORA is a planned Indian online store for artificial jewellery and hair accessories, run by one owner in Delhi. Customers can check out as guests or with an account. There's no payment gateway and no cash on delivery in the first version.

- **UPI:** the customer pays the full total by UPI, and submits a transaction reference. The owner confirms the money in the bank or UPI account, records it, and separately confirms the order.
- **Payment proofs:** a customer may upload a screenshot. It's a clue for finding the payment and never changes payment status.
- **Shipping:** arranged manually by the owner after payment.

## 1. GST and invoices

| # | Question | Planned default | Answer |
|---|---|---|---|
| 1.1 | Must the business register for GST before selling online, and from what date? Which scheme fits? | Unknown | |
| 1.2 | If unregistered or on a composition scheme, what document goes to the customer instead of a tax invoice? | Unknown | |
| 1.3 | Which HSN codes and GST rates apply to each product type, and how many HSN digits are needed? | Stored per product, values blank | |
| 1.4 | Are prices tax-inclusive, and how should the tax be calculated from them? | `prices_include_tax` stored per order | |
| 1.5 | How are shipping charges taxed? | Stored separately on each order | |
| 1.6 | How do discounts affect the taxable value of each item? | Allocated to items, ₹0 at launch | |
| 1.7 | Are the draft invoice fields right? Number unique per financial year and at most 16 characters, date, seller name, address and GSTIN, buyer details, place of supply, HSN, reverse-charge flag, tax split. | Based on CGST Rule 46 | |
| 1.8 | When is a credit note needed for returns and refunds, and what must it contain? | Unknown | |

## 2. Retention

| # | Question | Planned default | Answer |
|---|---|---|---|
| 2.1 | How long must orders, invoices, credit notes, payment records and customer transaction references be kept? | Kept, period unknown | |
| 2.2 | Does a customer's payment screenshot count as a record that must be kept? | Unknown | |
| 2.3 | Is 90 days after order closure appropriate for payment proofs? | **Provisional.** No automatic deletion is built. | |
| 2.4 | What counts as closure? Proposed: final order state, refunds settled, and all reviews resolved. If real money moves after closure, the order reopens financially and the retention period restarts. Is that right? | Provisional | |
| 2.5 | Which disputes and legal obligations should pause deletion, and for how long? | `legal_hold` per proof | |
| 2.6 | How should a customer's deletion request be handled when records must be kept? | Unknown | |

## 3. Payment proof recovery and privacy

Proofs may show names, bank names, UPI IDs and amounts. They sit in a private storage bucket, separate from database backups. **Whether to back them up off-site is undecided.** The bank and UPI account, and the payment ledger, remain the record of money received in both options.

| | Option A: no off-site copy | Option B: separate encrypted copy |
|---|---|---|
| **If storage is lost** | Files are gone. Each affected proof is marked unavailable, and payment records are unaffected. | Files can be restored and checked against recorded checksums |
| **Privacy** | Fewer copies exist | More copies exist, needing key management and access control |
| **Retention** | Deletion removes the only copy | Deletion must also reach the backup copies, within a stated period |
| **Evidence value** | Lost if a dispute follows a disaster | Kept during the retention period |
| **Added work** | None | Encryption, storage, restore tests, possibly storage cost |

Questions:

1. Is losing proofs in a disaster acceptable, given bank records survive?
2. Would either option conflict with duties to keep records or to delete personal data?
3. If Option B is used, how long may a backup copy outlive deletion from the main store?
4. What should the privacy notice say about proofs and backups?

**Database backups** also hold personal data, password hashes and possibly MFA secrets. They're planned to be encrypted and kept for 30 days. Is that period acceptable, and how should it be described to customers?

## 4. Refund policy and accounting

| # | Question | Planned default | Answer |
|---|---|---|---|
| 4.1 | Is shipping refundable on cancellation or return? Can return or undelivered-parcel shipping be deducted? | Unknown | |
| 4.2 | Must a payment arriving after cancellation be refunded in full, and how quickly? | Refund recorded as owed, in full | |
| 4.3 | Is there a maximum refund time, and how must it be explained to customers? | Unknown | |
| 4.4 | A customer pays the wrong amount. What must happen to an underpayment or overpayment? May excess ever be kept? | Excess refunded, or a decision recorded | |
| 4.5 | Is the planned wording suitable? "Order placed, not yet confirmed", then "Expired, order wasn't confirmed" after a 2-hour provisional window, and any stated submission deadline. | Provisional | |
| 4.6 | What must the cancellation, return and refund policies say, including lost and undelivered parcels? | Replacement for damaged items, with an unboxing video requested | |
| 4.7 | The bank reverses a customer's payment after a refund was already sent. **How is that loss treated in the accounts?** The system has no write-off, and keeps the order under review until a treatment is approved. | Unresolved | |
| 4.8 | A refund goes to the wrong person, and can't be recovered. How is it treated, and what is owed to the customer who really paid? | Unresolved | |
| 4.9 | A refund recipient voluntarily sends money back. Is that a customer receipt, a refund reversal, or its own category? It's kept outside the ledger for now. | Unresolved | |

**For later, not the first version:** if cash on delivery is added, COD fees and their tax, invoice timing, courier deductions, and refund timing before courier remittance will need review.

## 5. Ecommerce, privacy and product rules

| # | Question | Answer |
|---|---|---|
| 5.1 | Consumer Protection (E-Commerce) Rules 2020: what seller and grievance officer details must be displayed? Must a home address be shown? | |
| 5.2 | Must country of origin be shown on product pages? | |
| 5.3 | Legal Metrology: what declarations are needed on product packs and listings? | |
| 5.4 | DPDP: what duties apply to a small business, from when, and what must the privacy notice and consent say? | |
| 5.5 | Is a personal UPI ID acceptable, or is a business or merchant ID needed? | |
| 5.6 | Is ₹1,200 a realistic compliance budget? | |
