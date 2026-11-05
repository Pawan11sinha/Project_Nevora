"use client";

// Used when the root layout itself fails, so it needs its own html and body.
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#F8F5F0", color: "#2B2826", fontFamily: "serif", padding: "2rem" }}>
        <h1>Something went wrong</h1>
        <p>Please try again. If it keeps happening, contact us on WhatsApp.</p>
        <button type="button" onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
