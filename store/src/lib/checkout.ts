// Checkout detail rules, with no browser or framework code, so they can be tested directly.
// These checks help the customer fill in the form. The server will repeat every check before saving an order.

export type CheckoutDetails = {
  name: string;
  phone: string;
  email: string;
  address: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
};
export type CheckoutField = keyof CheckoutDetails;
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

// Keys are in the order the form shows them, so the first problem found is the first one on screen.
export const EMPTY_DETAILS: CheckoutDetails = { name: "", phone: "", email: "", address: "", landmark: "", pincode: "", city: "", state: "" };
export const OPTIONAL_FIELDS: CheckoutField[] = ["email", "landmark"];

/** The 28 states and 8 union territories of India. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
// Places may contain digits, such as the district "24 Paraganas North", but need at least one letter.
const PLACE = /^(?=.*\p{L})[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .'()-]*$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PINCODE = /^[1-9]\d{5}$/;

/**
 * Accepts the common ways people type an Indian mobile number, such as "98765 43210", "+91 98765-43210"
 * or "098765 43210", and returns the 10 digits, or null if it isn't a valid mobile number.
 */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "");
  if (!/^\+?\d+$/.test(digits)) return null;
  const plain = digits.replace(/^\+/, "");
  const local = plain.length === 12 && plain.startsWith("91") ? plain.slice(2) : plain.length === 11 && plain.startsWith("0") ? plain.slice(1) : plain;
  if (digits.startsWith("+") && !(plain.length === 12 && plain.startsWith("91"))) return null;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

export function validateField(field: CheckoutField, raw: string): string | undefined {
  const value = raw.trim();
  switch (field) {
    case "name":
      if (!value) return "Enter your full name.";
      if (value.length < 2 || value.length > 80) return "Enter a name between 2 and 80 characters.";
      if (!NAME.test(value)) return "Use letters, spaces, full stops, apostrophes or hyphens only.";
      return;
    case "phone":
      if (!value) return "Enter your mobile number.";
      if (!normalisePhone(value)) return "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.";
      return;
    case "email":
      if (!value) return;
      if (value.length > 254 || !EMAIL.test(value)) return "Enter a valid email address, or leave it blank.";
      return;
    case "address":
      if (!value) return "Enter your house or flat number and street.";
      if (value.length < 5 || value.length > 200) return "Enter an address between 5 and 200 characters.";
      return;
    case "landmark":
      if (value.length > 100) return "Keep the landmark under 100 characters.";
      return;
    case "city":
      if (!value) return "Enter your city or town.";
      if (value.length < 2 || value.length > 60 || !PLACE.test(value)) return "Enter a valid city or town name.";
      return;
    case "state":
      if (!value) return "Choose your state or union territory.";
      if (!(INDIAN_STATES as readonly string[]).includes(value)) return "Choose a state or union territory from the list.";
      return;
    case "pincode":
      if (!value) return "Enter your PIN code.";
      if (!PINCODE.test(value)) return "Enter a valid 6-digit PIN code.";
      return;
  }
}

export function validateDetails(details: CheckoutDetails): CheckoutErrors {
  const errors: CheckoutErrors = {};
  for (const field of Object.keys(EMPTY_DETAILS) as CheckoutField[]) {
    const message = validateField(field, details[field]);
    if (message) errors[field] = message;
  }
  return errors;
}
