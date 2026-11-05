"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div data-testid="error-page" className="flex flex-col items-start gap-3">
      <h1 className="font-serif text-3xl text-[#46372F]">Something went wrong</h1>
      <p>Please try again. If it keeps happening, contact us on WhatsApp.</p>
      <button type="button" onClick={reset} className="rounded bg-[#46372F] p-2 text-[#F8F5F0]">
        Try again
      </button>
    </div>
  );
}
