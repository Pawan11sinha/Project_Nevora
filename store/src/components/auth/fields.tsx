"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { passwordChecks } from "@/lib/auth/validation";

// Form pieces for the sign-in screens. Labels are always visible, errors sit under their field and are linked to it
// (aria-describedby), and every control is at least 44px tall for touch.

const inputClass =
  "mt-1.5 block min-h-12 w-full border bg-white px-3.5 text-base text-espresso placeholder:text-control focus:border-espresso focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso";

export function TextField({ label, name, error, hint, ...input }: { label: string; name: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const described = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <input id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={described} className={`${inputClass} ${error ? "border-[#9b2c2c]" : "border-line"}`} {...input} />
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-soft">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-[#9b2c2c]">{error}</p>}
    </div>
  );
}

export function PasswordField({ label, name, error, autoComplete, showChecklist = false }: { label: string; name: string; error?: string; autoComplete: "current-password" | "new-password"; showChecklist?: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  // The input itself is uncontrolled, so React's form reset after each submission clears it: a password is never
  // put back into the page. This copy only drives the checklist, and follows the reset.
  const [value, setValue] = useState("");
  useEffect(() => {
    const form = input.current?.form;
    const clear = () => setValue("");
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, []);
  const described = [error && `${id}-error`, showChecklist && `${id}-rules`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <div className="relative">
        <input
          ref={input}
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={200}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={`${inputClass} pr-20 ${error ? "border-[#9b2c2c]" : "border-line"}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute right-1 top-[calc(50%+3px)] min-h-11 -translate-y-1/2 px-3 text-sm font-semibold underline decoration-gold underline-offset-4 hover:decoration-espresso"
        >
          {visible ? "Hide" : "Show"}<span className="sr-only"> password</span>
        </button>
      </div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-[#9b2c2c]">{error}</p>}
      {showChecklist && (
        <ul id={`${id}-rules`} aria-label="Password requirements" className="mt-2 grid gap-1 text-xs text-ink-soft sm:grid-cols-2">
          {passwordChecks(value).map((r) => (
            <li key={r.id} className={`flex items-center gap-1.5 ${r.met ? "text-espresso" : ""}`}>
              <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${r.met ? "bg-espresso" : "border border-control"}`} />
              {r.label}<span className="sr-only">{r.met ? ", done" : ", not yet"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center bg-espresso px-6 text-sm font-semibold tracking-wide text-ivory transition-colors duration-200 hover:bg-espresso-deep disabled:cursor-wait disabled:opacity-70">
      {pending ? pendingText : children}
    </button>
  );
}

export function FormAlert({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`border-l-2 px-4 py-3 text-sm leading-relaxed ${tone === "error" ? "border-[#9b2c2c] bg-[#f9ecea] text-[#7a2323]" : "border-gold bg-cream text-espresso"}`}>
      {children}
    </div>
  );
}
