// Next.js answers 500 for dynamic-route paths it can't decode, such as /products/%FF. The Worker answers 400 instead.
// Most paths have no "%", so they skip the work.
export function isDecodablePath(pathname: string): boolean {
  if (!pathname.includes("%")) return true;
  try {
    decodeURIComponent(pathname);
    return true;
  } catch {
    return false;
  }
}
