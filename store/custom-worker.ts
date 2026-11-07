// Wraps the Worker that OpenNext generates, using OpenNext's documented custom Worker approach.
// Static files never reach this code: Cloudflare serves them from static assets first.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { gateDecision, gateResponse } from "./src/lib/staging-gate";
import { isDecodablePath } from "./src/lib/url-guard";

type Env = { STAGING_PASSWORD?: string };

const worker = {
  fetch(request: Request, env: Env, ctx: unknown) {
    const url = new URL(request.url);
    // Staging password gate first, before URL parsing, Next.js or any other code. See src/lib/staging-gate.ts.
    const decision = gateDecision(url, request.headers.get("Authorization"), env.STAGING_PASSWORD);
    if (decision !== "allow") return gateResponse(decision);
    if (!isDecodablePath(url.pathname)) {
      return new Response("Bad Request", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      });
    }
    // The app never sees the staging password.
    const headers = new Headers(request.headers);
    headers.delete("Authorization");
    return handler.fetch(new Request(request, { headers }), env, ctx);
  },
};

export default worker;
