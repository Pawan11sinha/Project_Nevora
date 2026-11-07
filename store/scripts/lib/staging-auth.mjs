// The staging password, used only by the check scripts to get past the staging Worker's password gate
// (src/lib/staging-gate.ts).
//
// The password is never stored in the project or Git. It's read from the STAGING_PASSWORD environment variable, or from
// the macOS Keychain:
//   security add-generic-password -a "$USER" -s nevora-staging-password -w      (prompts for the password)
// It's sent only on HTTPS requests to the staging host, never to localhost or any other site, and never printed.
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const STAGING_HOST = /^nevora-store-staging\.[a-z0-9-]+\.workers\.dev$/;

/** True only for https://nevora-store-staging.<account>.workers.dev URLs. */
export function isStaging(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && STAGING_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

function keychain(service) {
  if (process.platform !== "darwin") return "";
  try {
    return execFileSync("security", ["find-generic-password", "-s", service, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

let password;
function stagingPassword() {
  password ??= process.env.STAGING_PASSWORD || keychain("nevora-staging-password");
  if (!password) throw new Error("Staging needs its password: add it to the macOS Keychain (see scripts/lib/staging-auth.mjs) or set STAGING_PASSWORD.");
  return password;
}

/** The sign-in header for a URL: the staging password for staging, nothing for anything else. */
export function stagingHeaders(url) {
  if (!isStaging(url)) return {};
  return { Authorization: `Basic ${Buffer.from(`nevora:${stagingPassword()}`).toString("base64")}` };
}

/** fetch() that signs in to staging only. */
export function stagingFetch(url, init = {}) {
  return fetch(url, { ...init, headers: { ...(init.headers ?? {}), ...stagingHeaders(String(url)) } });
}

/**
 * Launches Chrome. When BASE_URL is staging, every new browser context signs in on staging requests only. Scripts that
 * intercept requests themselves must use route.fallback(), not route.continue(), so the request still reaches this.
 */
export async function launchBrowser() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  // Only when testing staging: any route handler turns off Playwright's HTTP cache, which would change local runs.
  if (!isStaging(process.env.BASE_URL ?? "")) return browser;
  stagingPassword(); // fail early, before any test runs, if the password is missing
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const context = await newContext(options);
    await context.route((url) => isStaging(url.href), (route) => route.continue({ headers: { ...route.request().headers(), ...stagingHeaders(route.request().url()) } }));
    return context;
  };
  return browser;
}
