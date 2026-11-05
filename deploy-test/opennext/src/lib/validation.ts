import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
});

export const signupSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(256),
});

// Only these two destinations are allowed after login, so a form value can't
// redirect someone to another site.
export const loginDestination = (next: unknown) => (next === "/admin" ? "/admin" : "/account");
