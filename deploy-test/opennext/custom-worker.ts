// Wraps the Worker that OpenNext generates, using OpenNext's documented custom Worker approach.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { isDecodablePath } from "./src/lib/url-guard";

const worker = {
  fetch(request: Request, env: unknown, ctx: unknown) {
    if (!isDecodablePath(new URL(request.url).pathname)) {
      return new Response("Bad Request", {
        status: 400,
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
