// Session cookie settings for server-only authentication.
//
// HttpOnly works because this app has no Supabase browser client: all auth runs in
// server code. If a browser client is ever added, for example for Realtime, HttpOnly
// must come off, because that client has to read these cookies.
//
// Don't add a short maxAge. The cookie holds the refresh token, and Supabase's guide
// warns that a short lifetime only degrades the session.
export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;
