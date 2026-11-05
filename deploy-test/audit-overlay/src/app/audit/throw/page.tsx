export const dynamic = "force-dynamic";
export default function ThrowPage() {
  throw new Error("AUDIT_SECRET_ERROR_MARKER");
  return null;
}
