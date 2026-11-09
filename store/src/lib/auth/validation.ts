// Validation for customer sign-up, sign-in and the profile form. The same rules run in the browser
// (for instant feedback) and on the server (which is what counts). Password rules match supabase/config.toml and must
// match the hosted project's settings: at least 10 characters, with lower case, upper case and a digit.
import { z } from "zod";

export const PASSWORD_MIN = 10;
/** Supabase hashes passwords with bcrypt, which ignores anything past 72 bytes, so longer passwords are refused. */
export const PASSWORD_MAX = 72;

export const PASSWORD_RULES = [
  { id: "length", label: `At least ${PASSWORD_MIN} characters`, test: (p: string) => p.length >= PASSWORD_MIN },
  { id: "lower", label: "A lower-case letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "upper", label: "An upper-case letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "digit", label: "A number", test: (p: string) => /[0-9]/.test(p) },
] as const;

export const passwordChecks = (password: string) => PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, met: r.test(password) }));

const email = z.string().trim().toLowerCase().min(1, "Enter your email address.").max(320, "That email address is too long.").pipe(z.email("Enter a valid email address."));

const password = z
  .string()
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`)
  .refine((p) => new TextEncoder().encode(p).length <= PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`)
  .refine((p) => PASSWORD_RULES.every((r) => r.test(p)), "Use at least 10 characters, with an upper-case letter, a lower-case letter and a number.");

const fullName = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(100, "Use at most 100 characters.")
  // Letters from any language, spaces and the punctuation names use. No angle brackets, digits or control characters.
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u, "Use letters, spaces, apostrophes, full stops and hyphens only.");

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|0)/, ""))
  .refine((v) => v === "" || /^[6-9][0-9]{9}$/.test(v), "Enter a 10-digit Indian mobile number, or leave it blank.");

export const signUpSchema = z
  .object({ fullName, email, password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "The passwords don't match." });

export const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX * 4) });

export const profileSchema = z.object({ fullName, phone });

export type FieldErrors = Partial<Record<string, string>>;

/** The first error for each field, ready to show next to it. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
