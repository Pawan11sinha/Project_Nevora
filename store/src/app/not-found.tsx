import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="font-serif text-title font-medium leading-tight">We can&rsquo;t find that page</h1>
      <p className="mt-3 text-ink-soft">It may have moved, or it isn&rsquo;t available right now.</p>
      <div className="mt-7"><ButtonLink href="/">Back to home</ButtonLink></div>
    </main>
  );
}
