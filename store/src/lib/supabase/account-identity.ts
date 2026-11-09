import "server-only";
import { cookies } from "next/headers";
import { ACCOUNT_ID_COOKIE, isAccountId } from "@/lib/account-storage";
import { accountIdentityCookieOptions, readSupabaseConfig } from "./config";

export async function setAccountIdentityCookie(accountId: string): Promise<void> {
  const config = readSupabaseConfig();
  if (!config || !isAccountId(accountId)) throw new Error("Cannot set the account storage identity.");
  (await cookies()).set(ACCOUNT_ID_COOKIE, accountId, accountIdentityCookieOptions(config.siteUrl));
}

export async function clearAccountIdentityCookie(siteUrl?: string): Promise<void> {
  const config = readSupabaseConfig();
  const origin = siteUrl ?? config?.siteUrl;
  if (!origin) return;
  (await cookies()).set(ACCOUNT_ID_COOKIE, "", accountIdentityCookieOptions(origin, true));
}
