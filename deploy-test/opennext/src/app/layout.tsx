import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Inter({ variable: "--font-sans-test", subsets: ["latin"] });
const serif = Playfair_Display({ variable: "--font-serif-test", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Deployment test (sample data)",
  description: "Temporary deployment test. Not a real store.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-screen bg-[#F8F5F0] text-[#2B2826]">
        <p className="bg-[#46372F] p-2 text-center text-sm text-[#F8F5F0]">
          Deployment test with sample data. Not a real store.
        </p>
        <nav className="flex gap-4 p-4">
          <Link href="/" prefetch={false} className="font-serif text-xl text-[#46372F]">
            Test store
          </Link>
          <Link href="/c/earrings" prefetch={false}>Earrings</Link>
          <Link href="/account" prefetch={false}>Account</Link>
        </nav>
        <main className="mx-auto max-w-5xl p-4">{children}</main>
      </body>
    </html>
  );
}
