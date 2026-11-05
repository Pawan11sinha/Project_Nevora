// Wraps the Worker that OpenNext generates, using OpenNext's documented custom Worker approach.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { GATE_HEADER, gateAllows } from "./src/lib/test-gate";
import { isDecodablePath } from "./src/lib/url-guard";

const refuse = (status: number, text: string) =>
  new Response(text, {
    status,
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

const worker = {
  fetch(request: Request, env: { TEST_GATE_TOKEN?: string }, ctx: unknown) {
    // The gate runs first, before URL parsing, Next.js, proxy.ts, route handlers or any database call.
    if (!gateAllows(request.headers.get(GATE_HEADER), env.TEST_GATE_TOKEN)) {
      return refuse(404, "Not Found");
    }
    if (!isDecodablePath(new URL(request.url).pathname)) {
      return refuse(400, "Bad Request");
    }
    // The app never sees the token.
    const headers = new Headers(request.headers);
    headers.delete(GATE_HEADER);
    return handler.fetch(new Request(request, { headers }), env, ctx);
  },
};

export default worker;
