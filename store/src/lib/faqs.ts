// Frequently asked questions. Only answers confirmed by a recorded NÉVORA business decision are published; everything
// else stays a draft until the policy behind it exists. Drafts are never rendered on the storefront.
// Until the admin foundation exists (M3), entries are edited here: add, edit, delete, reorder (`order`) and publish
// (`status`). tests/faqs.test.mjs enforces the rules below.

export type Faq = {
  id: string;
  question: string;
  status: "published" | "draft";
  /** Display order, lowest first. */
  order: number;
  /** Published entries only. Plain text; paragraphs separated by blank lines. */
  answer?: string;
  /** Published entries: the decision the answer rests on. Drafts: what it's waiting for. */
  source: string;
};

export const FAQS: Faq[] = [
  {
    id: "place-order",
    question: "How can I place an order?",
    status: "published",
    order: 1,
    answer:
      "Choose the pieces you'd like, then contact us on WhatsApp. We'll reply with manual UPI payment instructions.\n\nWe don't use an online payment gateway, and there's no card or online payment on this website. Your order is confirmed only after we've checked by hand that your UPI payment has reached our account.",
    source: "Owner's business decision restated on 8 Nov 2026: customers contact NÉVORA on WhatsApp first, then receive manual UPI payment instructions; no payment gateway. IMPLEMENTATION_ROADMAP.md: prepaid manual UPI only in V1 (7 Nov 2026); money recorded only after admin bank verification, separately from confirmation (7 Nov). The order-page and UTR steps in PROJECT_ARCHITECTURE.md aren't described here until the owner approves them (open decision 44).",
  },
  {
    id: "cod",
    question: "Do you offer Cash on Delivery?",
    status: "published",
    order: 2,
    answer: "Not at the moment. Every order is paid in advance by UPI, which we check by hand before confirming your order.",
    source: "IMPLEMENTATION_ROADMAP.md: no COD in V1 (decided 7 Nov 2026)",
  },
  {
    id: "delivery",
    question: "How long does delivery take?",
    status: "draft",
    order: 3,
    source: "Waiting for the courier choice and quotes (roadmap open decision 13, before M6)",
  },
  {
    id: "returns",
    question: "Can I return or exchange a product?",
    status: "draft",
    order: 4,
    source: "Waiting for the cancellation, return and refund policy (open decision 14) and CA/legal review (CA_LEGAL_REVIEW.md 4.6)",
  },
  {
    id: "care",
    question: "How should I care for my jewellery?",
    status: "draft",
    order: 5,
    source: "Waiting for supplier care guidance; no material or finish claims without supplier evidence and owner approval",
  },
  {
    id: "contact",
    question: "How can I contact NÉVORA?",
    status: "draft",
    order: 6,
    source: "Waiting for the WhatsApp business number (open decision 12) and a domain email address",
  },
];

/** The entries customers see, in display order. */
export const publishedFaqs = () => FAQS.filter((f) => f.status === "published" && f.answer).sort((a, b) => a.order - b.order);
