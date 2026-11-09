// Customer-facing wording for Supabase Auth errors. Messages never confirm whether an account exists for an email
// address, so nobody can use the forms to find out who shops at NÉVORA.

export const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";

const BY_CODE: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Check them and try again.",
  weak_password: "Choose a stronger password: at least 10 characters, with an upper-case letter, a lower-case letter and a number.",
  over_request_rate_limit: "Too many attempts. Please wait a few minutes and try again.",
  session_not_found: "Your session has ended. Please sign in again.",
  signup_disabled: "New accounts can't be created at the moment.",
  email_address_invalid: "Enter a valid email address.",
  validation_failed: "Please check the details you entered.",
};

/** Messages shown on the sign-in page after a redirect, keyed by ?error=. */
export const LINK_ERRORS: Record<string, string> = {
  oauth: "Google sign-in didn't complete. Please try again, or use your email and password.",
  "oauth-cancelled": "Google sign-in was cancelled.",
  expired: "Your session has ended. Please sign in again.",
  unavailable: "Sign-in isn't available at the moment. Please try again later.",
};

/** Messages shown after a successful step, keyed by ?status=. */
export const STATUS_MESSAGES: Record<string, string> = {
  "signed-out": "You've signed out.",
  "sign-out-warning": "We couldn't confirm that your session was revoked. It may still be active; please try signing out again.",
};

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (!error) return GENERIC_ERROR;
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  if (error.status === 429) return BY_CODE.over_request_rate_limit;
  return GENERIC_ERROR;
}
