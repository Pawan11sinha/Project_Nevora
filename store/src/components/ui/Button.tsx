import Link from "next/link";

const base =
  "inline-flex min-h-11 items-center justify-center px-6 text-sm font-semibold tracking-wide transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60";
const variants = {
  primary: "bg-espresso text-ivory hover:bg-espresso-deep",
  secondary: "border border-espresso text-espresso hover:bg-espresso hover:text-ivory",
  quiet: "text-espresso underline decoration-gold decoration-1 underline-offset-4 hover:decoration-espresso",
};

type Variant = keyof typeof variants;

export function ButtonLink({ href, variant = "primary", children }: { href: string; variant?: Variant; children: React.ReactNode }) {
  return (
    <Link href={href} prefetch={false} className={`${base} ${variants[variant]}`}>
      {children}
    </Link>
  );
}

export function Button({ variant = "primary", children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
