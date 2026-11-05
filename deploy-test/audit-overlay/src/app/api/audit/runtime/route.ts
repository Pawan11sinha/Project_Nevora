import { AsyncLocalStorage } from "node:async_hooks";
import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

async function attempt(fn: () => unknown | Promise<unknown>) {
  try {
    const value = await fn();
    return value === undefined ? true : value;
  } catch (e) {
    return `FAILED: ${(e as Error).message}`;
  }
}

export async function GET() {
  const storage = new AsyncLocalStorage<number>();
  const report = {
    webCryptoDigest: await attempt(async () => (await crypto.subtle.digest("SHA-256", new TextEncoder().encode("x"))).byteLength === 32),
    randomUUID: await attempt(() => crypto.randomUUID().length === 36),
    nodeCryptoHash: await attempt(() => createHash("sha256").update("x").digest("hex").length === 64),
    nodeRandomBytes: await attempt(() => randomBytes(8).length === 8),
    buffer: await attempt(() => Buffer.from("x").toString("base64") === "eA=="),
    asyncLocalStorage: await attempt(() => storage.run(1, () => storage.getStore() === 1)),
    streams: await attempt(async () => (await new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("ok")); c.close(); } })).text()) === "ok"),
    compressionStream: await attempt(() => typeof CompressionStream === "function"),
    timers: await attempt(() => new Promise((r) => setTimeout(() => r(true), 5))),
    urlPattern: await attempt(() => "URLPattern" in globalThis),
    processEnvSet: await attempt(() => Boolean(process.env.SUPABASE_URL)),
    bindings: await attempt(async () => Object.keys(getCloudflareContext().env).filter((k) => /^[A-Z_]+$/.test(k) && !/SUPABASE|TOKEN/.test(k)).sort()),
    executionContext: await attempt(() => typeof getCloudflareContext().ctx.waitUntil === "function"),
    requestCf: await attempt(() => typeof getCloudflareContext().cf),
    headersApi: await attempt(async () => (await headers()).has("host")),
  };
  return NextResponse.json(report);
}
