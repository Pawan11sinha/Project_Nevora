// Next.js returns 500 for dynamic-route paths it can't decode. This lets the Worker
// answer with a clear 400 instead. Most paths have no "%", so they skip the work.
export function isDecodablePath(pathname: string) {
  if (!pathname.includes("%")) return true;
  try {
    decodeURIComponent(pathname);
    return true;
  } catch {
    return false;
  }
}
