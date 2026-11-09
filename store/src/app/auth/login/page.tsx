import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell, GoogleButton, OrDivider } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Sign in" };

// Pre-rendered: the form posts to a server action, and redirect messages are read in the browser.
export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Your account"
      title="Welcome back"
      intro="Sign in to see your account. You can always shop and check out as a guest."
      footer={<>New to NÉVORA? <Link prefetch={false} href="/auth/signup" className="font-semibold text-espresso underline decoration-gold underline-offset-4 hover:decoration-espresso">Create an account</Link></>}
    >
      <GoogleButton />
      <OrDivider />
      <Suspense><LoginForm /></Suspense>
    </AuthShell>
  );
}
