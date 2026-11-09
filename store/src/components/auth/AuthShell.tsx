import Link from "next/link";

// The frame shared by the sign-in screens: a single calm column on ivory, a serif heading and generous space.
export function AuthShell({ eyebrow, title, intro, children, footer }: { eyebrow?: string; title: string; intro?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="px-5 py-12 sm:py-16 lg:py-20">
      <div className="mx-auto w-full max-w-md">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{eyebrow}</p>}
        <h1 className="mt-2 font-serif text-title font-medium leading-[1.05]">{title}</h1>
        <span aria-hidden="true" className="mt-4 block h-px w-12 bg-gold" />
        {intro && <p className="mt-4 leading-relaxed text-ink-soft">{intro}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 border-t border-line pt-6 text-sm text-ink-soft">{footer}</div>}
      </div>
    </main>
  );
}

export function GoogleButton({ next, label = "Continue with Google" }: { next?: string; label?: string }) {
  const href = next ? `/auth/google?next=${encodeURIComponent(next)}` : "/auth/google";
  return (
    // A plain link: /auth/google starts the sign-in on the server and sends the browser to Google.
    <Link prefetch={false} href={href} className="flex min-h-12 w-full items-center justify-center gap-3 border border-espresso bg-white px-6 text-sm font-semibold tracking-wide text-espresso transition-colors duration-200 hover:bg-cream">
      {/* Google's "G" mark, in its own colours as Google's sign-in guidelines require. */}
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      {label}
    </Link>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft" role="separator" aria-label="or">
      <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
    </div>
  );
}
