import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, GoogleButton, OrDivider } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Join NÉVORA"
      title="Create your account"
      intro="An account is optional. It keeps your details in one place for next time."
      footer={
        <>
          <p>Already have an account? <Link prefetch={false} href="/auth/login" className="font-semibold text-espresso underline decoration-gold underline-offset-4 hover:decoration-espresso">Sign in</Link></p>
          <p className="mt-3 text-xs leading-relaxed">By creating an account you agree to our <Link prefetch={false} href="/info/terms" className="underline underline-offset-4">Terms</Link> and <Link prefetch={false} href="/info/privacy" className="underline underline-offset-4">Privacy Policy</Link>.</p>
        </>
      }
    >
      <GoogleButton label="Sign up with Google" />
      <OrDivider />
      <SignUpForm />
    </AuthShell>
  );
}
