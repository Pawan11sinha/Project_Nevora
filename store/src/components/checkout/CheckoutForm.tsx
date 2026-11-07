"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useBagLines } from "@/components/cart/bag-store";
import { ProductImage } from "@/components/catalogue/ProductImage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { itemCount, resolveLines, subtotalPaise, type ResolvedLine } from "@/lib/cart";
import { EMPTY_DETAILS, INDIAN_STATES, validateDetails, validateField, type CheckoutDetails, type CheckoutErrors, type CheckoutField } from "@/lib/checkout";
import { lookupPin } from "@/lib/pin-lookup";
import { PIN_DATA_PATH, PIN_PATTERN, type NearestOffice, type PinPlace } from "@/lib/pincode";
import { findProduct, formatPrice } from "@/lib/sample-catalogue";
import { LocationButton } from "./LocationButton";

// Details live only in this component's memory. They're never written to browser storage or sent anywhere,
// because order saving doesn't exist yet. Leaving or refreshing the page clears them.
// A full PIN code is looked up in NÉVORA's own static files (see lib/pincode.ts); the only thing requested is the
// file for the PIN's first three digits.

const inputClass =
  "mt-1.5 block min-h-12 w-full border bg-ivory px-3 text-base text-espresso outline-none transition-colors duration-200 placeholder:text-ink-soft focus-visible:border-espresso aria-[invalid=true]:border-2 aria-[invalid=true]:border-espresso";
const linkClass = "font-semibold underline decoration-gold underline-offset-4 hover:decoration-espresso";

type FieldConfig = { field: CheckoutField; label: string; autoComplete: string; inputMode?: "numeric" | "tel" | "email" | "text"; hint?: string; maxLength?: number };

const contactFields: FieldConfig[] = [
  { field: "name", label: "Full name", autoComplete: "name", maxLength: 80 },
  { field: "phone", label: "Mobile number", autoComplete: "tel-national", inputMode: "tel", hint: "10-digit Indian mobile number. We'll use it for your order on WhatsApp.", maxLength: 16 },
  { field: "email", label: "Email address", autoComplete: "email", inputMode: "email", hint: "For your order confirmation.", maxLength: 254 },
];
const addressFields: FieldConfig[] = [
  { field: "address", label: "House or flat number, and street", autoComplete: "address-line1", maxLength: 200 },
  { field: "landmark", label: "Landmark", autoComplete: "address-line2", hint: "For example, near the post office.", maxLength: 100 },
];
const cityField: FieldConfig = { field: "city", label: "City or town", autoComplete: "address-level2", maxLength: 60 };

type PinStatus =
  | { kind: "idle" }
  | { kind: "loading"; pin: string }
  | { kind: "found"; pin: string; places: PinPlace[]; chosen: number; kept: boolean }
  | { kind: "unknown"; pin: string }
  | { kind: "failed"; pin: string };

const placeName = (place: { city: string; state: string | null }) => (place.state ? `${place.city}, ${place.state}` : place.city);

function pinMessage(status: PinStatus): string {
  switch (status.kind) {
    case "idle":
      return "";
    case "loading":
      return "Looking up this PIN code\u2026";
    case "unknown":
      return `We couldn't find PIN ${status.pin} in India Post's list. Please check it, or fill in your city and state yourself.`;
    case "failed":
      return `We couldn't look up PIN ${status.pin} just now. Please fill in your city and state yourself.`;
    case "found": {
      const place = status.places[status.chosen];
      if (status.places.length > 1) return `PIN ${status.pin} covers more than one district. Choose yours below.`;
      if (status.kept) return `PIN ${status.pin} is listed under ${placeName(place)}. We've kept the city and state you typed, so please check they match.`;
      if (!place.state) return `Found PIN ${status.pin} in ${place.city}. Please choose your state.`;
      return `Found PIN ${status.pin}: ${placeName(place)}. We've filled in your city and state. You can change them, for example to your town's name.`;
    }
  }
}

function examplesText(place: PinPlace) {
  const count = `${place.offices} post ${place.offices === 1 ? "office" : "offices"}`;
  const names = place.examples;
  if (names.length === 0) return count;
  const shown = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return place.offices > names.length ? `${count}, including ${shown}` : `${count}: ${shown}`;
}

function Label({ id, label, optional }: { id: string; label: string; optional: boolean }) {
  return (
    <label htmlFor={id} className="text-sm font-semibold">
      {label}
      {optional ? <span className="ml-1.5 font-normal text-ink-soft">(optional)</span> : <span aria-hidden="true" className="ml-0.5">*</span>}
    </label>
  );
}

function FieldMessages({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  return (
    <>
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-soft">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold"><span aria-hidden="true">! </span>{error}</p>}
    </>
  );
}

function SummaryLine({ line }: { line: ResolvedLine }) {
  return (
    <li className="flex gap-3 border-b border-line py-4">
      <div className="w-16 shrink-0">{line.product && <ProductImage art={line.product.art} alt="" sizes="64px" />}</div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-serif text-[1.1rem] font-medium leading-snug">{line.product?.name}</p>
        <p className="text-ink-soft">Finish: {line.finish}</p>
        <p className="text-ink-soft">{line.quantity} &times; {formatPrice(line.unitPaise)}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold">{formatPrice(line.linePaise)}</p>
    </li>
  );
}

export function CheckoutForm() {
  const lines = useBagLines();
  const [details, setDetails] = useState<CheckoutDetails>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [touched, setTouched] = useState<Partial<Record<CheckoutField, boolean>>>({});
  const [pinStatus, setPinStatus] = useState<PinStatus>({ kind: "idle" });
  // The latest details, for PIN lookups that finish after later typing.
  const detailsRef = useRef(details);
  useEffect(() => { detailsRef.current = details; });
  // The PIN most recently typed or filled, so an older lookup can't overwrite a newer one.
  const pinRequest = useRef("");
  // The city and state values this form last filled in. Only those, or empty fields, are replaced by a PIN lookup.
  const autoFilled = useRef<{ city?: string; state?: string }>({});

  if (lines === null) {
    return (
      <>
        <p className="mt-6 text-ink-soft">Loading your bag&hellip;</p>
        <noscript><p className="mt-2 text-sm">Checkout needs JavaScript turned on in your browser.</p></noscript>
      </>
    );
  }

  const resolved = resolveLines(lines, findProduct);
  const available = resolved.filter((line) => !line.problem);
  const unavailable = resolved.length - available.length;

  if (available.length === 0) {
    return (
      <div className="mt-6">
        <p className="text-lg">{lines.length === 0 ? "Your bag is empty." : "Nothing in your bag is available right now."}</p>
        <p className="mt-1 text-ink-soft">Add a piece to your bag before checking out.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/">Continue shopping</ButtonLink>
          {lines.length > 0 && <ButtonLink href="/bag" variant="secondary">View bag</ButtonLink>}
        </div>
      </div>
    );
  }

  const count = itemCount(available);
  const subtotal = subtotalPaise(resolved);

  const update = (field: CheckoutField, value: string) => {
    setDetails((d) => ({ ...d, [field]: value }));
    // Once a field has been left, its message updates as the customer corrects it.
    if (touched[field]) setErrors((e) => ({ ...e, [field]: validateField(field, value) }));
    if (field === "pincode") findPin(value.trim());
  };

  // Sets filled-in values, updating any error message already showing for them.
  const apply = (values: Partial<CheckoutDetails>) => {
    setDetails((d) => ({ ...d, ...values }));
    setErrors((e) => {
      const next = { ...e };
      for (const [field, value] of Object.entries(values) as [CheckoutField, string][]) if (e[field]) next[field] = validateField(field, value);
      return next;
    });
  };

  // Fills city and state from a place. Unless `replace` is set, a value the customer typed themselves is kept.
  // Returns true if a typed value was kept and differs from the place.
  const fillPlace = (place: { city: string; state: string | null }, replace: boolean) => {
    const current = detailsRef.current;
    const mayReplace = (field: "city" | "state") => replace || !current[field].trim() || current[field] === autoFilled.current[field];
    const values: Partial<CheckoutDetails> = {};
    let kept = false;
    if (mayReplace("city")) values.city = place.city;
    else kept = current.city.trim().toLowerCase() !== place.city.toLowerCase();
    if (place.state) {
      if (mayReplace("state")) values.state = place.state;
      else kept ||= current.state !== place.state;
    }
    autoFilled.current = { city: values.city ?? autoFilled.current.city, state: values.state ?? autoFilled.current.state };
    apply(values);
    return kept;
  };

  const findPin = (pin: string) => {
    pinRequest.current = pin;
    if (!PIN_PATTERN.test(pin)) {
      setPinStatus({ kind: "idle" });
      return;
    }
    setPinStatus({ kind: "loading", pin });
    lookupPin(pin).then(
      (places) => {
        if (pinRequest.current !== pin) return;
        if (places.length === 0) return setPinStatus({ kind: "unknown", pin });
        // The district with the most post offices is filled in first; the customer can choose another.
        const kept = fillPlace(places[0], false);
        setPinStatus({ kind: "found", pin, places, chosen: 0, kept });
      },
      () => { if (pinRequest.current === pin) setPinStatus({ kind: "failed", pin }); },
    );
  };

  const choosePlace = (index: number) => {
    if (pinStatus.kind !== "found") return;
    fillPlace(pinStatus.places[index], true);
    setPinStatus({ ...pinStatus, chosen: index, kept: false });
  };

  // The customer asked for this, so it replaces PIN, city and state. They can still change all three.
  const fillFromLocation = (office: NearestOffice) => {
    pinRequest.current = office.pin;
    autoFilled.current = {};
    apply({ pincode: office.pin });
    fillPlace(office, true);
    setPinStatus({ kind: "idle" });
  };
  const leave = (field: CheckoutField) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validateField(field, details[field]) }));
  };
  // Pressing Enter in a field checks every field and moves focus to the first problem. Nothing is submitted.
  const onKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      check();
    }
  };
  const check = () => {
    const all = validateDetails(details);
    setErrors(all);
    setTouched(Object.fromEntries(Object.keys(EMPTY_DETAILS).map((f) => [f, true])));
    const first = (Object.keys(EMPTY_DETAILS) as CheckoutField[]).find((f) => all[f]);
    if (first) document.getElementById(`checkout-${first}`)?.focus();
  };

  const describedBy = (field: CheckoutField, hint?: string) =>
    [hint ? `checkout-${field}-hint` : "", errors[field] ? `checkout-${field}-error` : ""].filter(Boolean).join(" ") || undefined;

  const renderInput = ({ field, label, autoComplete, inputMode, hint, maxLength }: FieldConfig) => {
    const id = `checkout-${field}`;
    const optional = field === "email" || field === "landmark";
    return (
      <div key={field}>
        <Label id={id} label={label} optional={optional} />
        <input
          id={id}
          name={field}
          type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          required={!optional}
          aria-invalid={errors[field] ? true : undefined}
          aria-describedby={describedBy(field, hint)}
          value={details[field]}
          onChange={(e) => update(field, e.target.value)}
          onBlur={() => leave(field)}
          className={`${inputClass} ${errors[field] ? "border-espresso" : "border-control"}`}
        />
        <FieldMessages id={id} hint={hint} error={errors[field]} />
      </div>
    );
  };

  return (
    <div className="mt-6 grid gap-10 md:grid-cols-[1fr_20rem] lg:grid-cols-[1fr_24rem] lg:gap-14">
      <aside aria-labelledby="order-summary-title" className="md:sticky md:top-28 md:order-last md:self-start">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="order-summary-title" className="font-serif text-heading font-medium">Your order</h2>
          <Link prefetch={false} href="/bag" className={`inline-flex min-h-11 items-center text-sm ${linkClass}`}>Edit bag</Link>
        </div>
        <ul className="mt-3 border-t border-line">
          {available.map((line) => <SummaryLine key={line.key} line={line} />)}
        </ul>
        {unavailable > 0 && (
          <p className="mt-3 text-sm">
            {unavailable === 1 ? "1 piece in your bag isn't available" : `${unavailable} pieces in your bag aren't available`}, so {unavailable === 1 ? "it isn't" : "they aren't"} included. <Link prefetch={false} href="/bag" className={`inline-block py-0.5 ${linkClass}`}>Edit bag</Link>
          </p>
        )}
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt>Subtotal ({count} {count === 1 ? "item" : "items"})</dt><dd>{formatPrice(subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd className="text-ink-soft">Confirmed with your order</dd></div>
          <div className="flex items-baseline justify-between border-t border-line pt-3"><dt className="font-semibold">Total before shipping</dt><dd className="text-lg font-semibold">{formatPrice(subtotal)}</dd></div>
        </dl>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">Sample prices. Your final total is confirmed when you place your order.</p>
      </aside>

      <form noValidate onSubmit={(e) => e.preventDefault()} onKeyDown={onKeyDown} aria-labelledby="checkout-details-title" className="min-w-0">
        <h2 id="checkout-details-title" className="sr-only">Your details</h2>
        <p className="text-sm text-ink-soft">Fields marked <span aria-hidden="true">*</span><span className="sr-only">with an asterisk</span> are required.</p>
        <fieldset className="mt-6">
          <legend className="font-serif text-heading font-medium">Contact</legend>
          <div className="mt-4 grid gap-5">{contactFields.map(renderInput)}</div>
        </fieldset>
        <fieldset className="mt-10">
          <legend className="font-serif text-heading font-medium">Delivery address</legend>
          <div className="mt-4 grid gap-5">
            <LocationButton pin={details.pincode} onFound={fillFromLocation} />
            {addressFields.map(renderInput)}
            <div className="sm:w-1/2 sm:pr-2.5">
              <Label id="checkout-pincode" label="PIN code" optional={false} />
              <input
                id="checkout-pincode"
                name="pincode"
                type="text"
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={6}
                required
                aria-invalid={errors.pincode ? true : undefined}
                aria-describedby={[describedBy("pincode"), pinStatus.kind !== "idle" ? "checkout-pincode-lookup" : ""].filter(Boolean).join(" ") || undefined}
                value={details.pincode}
                onChange={(e) => update("pincode", e.target.value)}
                onBlur={() => leave("pincode")}
                className={`${inputClass} ${errors.pincode ? "border-espresso" : "border-control"}`}
              />
              <FieldMessages id="checkout-pincode" error={errors.pincode} />
              <p id="checkout-pincode-lookup" role="status" className="mt-1.5 text-sm leading-relaxed text-ink-soft empty:hidden">{pinMessage(pinStatus)}</p>
            </div>
            {pinStatus.kind === "found" && pinStatus.places.length > 1 && (
              <fieldset>
                <legend className="text-sm font-semibold">Which district is your address in?</legend>
                <div className="mt-2 grid gap-2">
                  {pinStatus.places.map((place, i) => (
                    <label key={`${place.city}|${place.state}`} className={`flex min-h-12 cursor-pointer items-start gap-3 border px-3 py-2.5 ${i === pinStatus.chosen ? "border-espresso" : "border-control"}`}>
                      <input type="radio" name="pin-place" checked={i === pinStatus.chosen} onChange={() => choosePlace(i)} className="mt-1 size-4 shrink-0 accent-espresso" />
                      <span className="text-sm">
                        <span className="block font-semibold">{placeName(place)}</span>
                        <span className="block text-ink-soft">{examplesText(place)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              {renderInput(cityField)}
              <div>
                <Label id="checkout-state" label="State or union territory" optional={false} />
                <select
                  id="checkout-state"
                  name="state"
                  autoComplete="address-level1"
                  required
                  aria-invalid={errors.state ? true : undefined}
                  aria-describedby={describedBy("state")}
                  value={details.state}
                  onChange={(e) => update("state", e.target.value)}
                  onBlur={() => leave("state")}
                  className={`${inputClass} ${errors.state ? "border-espresso" : "border-control"}`}
                >
                  <option value="">Choose&hellip;</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <FieldMessages id="checkout-state" error={errors.state} />
              </div>
            </div>
            <p className="text-sm leading-relaxed text-ink-soft">
              PIN code suggestions use the India Post directory from the Department of Posts, Government of India, published on data.gov.in under the{" "}
              <a href="https://data.gov.in/government-open-data-license-india" target="_blank" rel="noopener noreferrer" className={`inline-block py-0.5 ${linkClass}`}>Government Open Data License – India<span className="sr-only"> (opens in a new tab)</span></a>.
              {" "}We&rsquo;ve reformatted it for this site (<a href={`${PIN_DATA_PATH}/NOTICE.txt`} target="_blank" rel="noopener noreferrer" className={`inline-block py-0.5 ${linkClass}`}>source and changes<span className="sr-only"> (opens in a new tab)</span></a>).
            </p>
          </div>
        </fieldset>
        <div className="mt-10 border-t border-line pt-6">
          {/* Submission arrives with order saving: the server will save the order first, then open WhatsApp. */}
          <Button disabled aria-describedby="place-order-note" className="min-h-12 w-full cursor-not-allowed !bg-ink-soft !text-ivory !opacity-100">Place order</Button>
          <p id="place-order-note" className="mt-3 text-sm leading-relaxed text-ink-soft">
            Placing orders is coming soon. Nothing you enter here is saved or sent, and your bag stays as it is.
          </p>
        </div>
      </form>
    </div>
  );
}
