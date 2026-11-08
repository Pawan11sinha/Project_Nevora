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
      "Add the pieces you love to your bag, then enter your delivery details at checkout. You can check out as a guest.\n\nWe don't use an online payment gateway, and you never pay on this website. After you place your order, your order page shows the exact amount with our UPI ID and QR code. Pay from your own UPI app, then enter the UPI transaction reference (UTR) on your order page. If you'd like help, you can message us on WhatsApp from the same page.\n\nYour order isn't confirmed yet at this point. We check by hand that your payment has reached our account, and then we confirm your order.",
    source: "PROJECT_ARCHITECTURE.md checkout steps 3–5 (order saved first, order page shows amount and UPI QR and ID, UTR reference required, WhatsApp optional); IMPLEMENTATION_ROADMAP.md: prepaid manual UPI only in V1, no gateway (7 Nov 2026); guest checkout (5 Nov); payment recorded only after admin bank verification, separately from confirmation (7 Nov)",
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
