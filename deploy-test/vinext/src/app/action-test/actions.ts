"use server";

import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().regex(/^[6-9]\d{9}$/),
});

export async function submitTest(_prev: { message: string }, form: FormData) {
  const result = schema.safeParse(Object.fromEntries(form));
  return { message: result.success ? "Valid" : "Invalid" };
}
