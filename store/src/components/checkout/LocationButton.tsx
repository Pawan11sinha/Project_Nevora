"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { UnsupportedBrowserError, loadGeo } from "@/lib/pin-lookup";
import { nearestOffice, type NearestOffice } from "@/lib/pincode";

// The location is asked for only when the customer presses the button. The coordinates stay in this function:
// they aren't kept in state, stored, logged or sent anywhere. The post office file is downloaded whole, so the
// request for it says nothing about where the customer is.

/** Beyond this, a phone's reported location is too rough to suggest a PIN code. */
const TOO_ROUGH_M = 20_000;
/** Beyond this, the suggestion comes with a warning that it may be for a nearby area. */
const ROUGH_M = 1_500;

type Status =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "found"; office: NearestOffice; roughKm: number | null }
  | { kind: "problem"; message: string };

const TYPE_INSTEAD = "You can type your PIN code instead.";

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }));
}

function problemFor(error: unknown): string {
  if (error instanceof UnsupportedBrowserError) return `This browser can't look up post offices. ${TYPE_INSTEAD}`;
  const code = (error as GeolocationPositionError | undefined)?.code;
  if (code === 1) return `Location access is off for this site. ${TYPE_INSTEAD}`;
  if (code === 2 || code === 3) return `We couldn't get your location just now. ${TYPE_INSTEAD}`;
  return `We couldn't load post office details just now. ${TYPE_INSTEAD}`;
}

/** `pin` is the form's current PIN: once the customer changes it, the old suggestion is hidden. */
export function LocationButton({ pin, onFound }: { pin: string; onFound: (office: NearestOffice) => void }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const locate = async () => {
    if (!navigator.geolocation) {
      setStatus({ kind: "problem", message: `This browser can't share your location. ${TYPE_INSTEAD}` });
      return;
    }
    setStatus({ kind: "busy" });
    try {
      // Ask for the location and download the post office file at the same time.
      const geoPromise = loadGeo();
      geoPromise.catch(() => {}); // handled below; this stops an unhandled rejection if the location fails first
      const { coords } = await position();
      if (coords.accuracy > TOO_ROUGH_M) {
        setStatus({ kind: "problem", message: `Your location wasn't precise enough to suggest a PIN code. ${TYPE_INSTEAD}` });
        return;
      }
      const office = nearestOffice(await geoPromise, coords.latitude, coords.longitude);
      if (!office) {
        setStatus({ kind: "problem", message: `We couldn't find a post office near your location. ${TYPE_INSTEAD}` });
        return;
      }
      setStatus({ kind: "found", office, roughKm: coords.accuracy > ROUGH_M ? Math.round(coords.accuracy / 1000) : null });
      onFound(office);
    } catch (error) {
      setStatus({ kind: "problem", message: problemFor(error) });
    }
  };

  const busy = status.kind === "busy";
  return (
    <div>
      <Button variant="secondary" onClick={locate} disabled={busy} aria-busy={busy || undefined} aria-describedby="location-note" className="min-h-12 w-full gap-2 sm:w-auto">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.3" />
        </svg>
        {busy ? "Finding your nearest post office…" : "Use my current location"}
      </Button>
      <p id="location-note" className="mt-2 text-sm leading-relaxed text-ink-soft">
        Fills in your PIN code, city and state. Your location stays on your device and isn&rsquo;t saved or sent to us.
      </p>
      <div role="status" className="text-sm leading-relaxed">
        {status.kind === "found" && status.office.pin === pin.trim() && (
          <p className="mt-3 border-l-2 border-gold pl-3">
            Suggested from the post office nearest to you: <span className="font-semibold">PIN {status.office.pin}, {status.office.city}{status.office.state ? `, ${status.office.state}` : ""}</span>.{" "}
            {status.roughKm !== null && <>Your phone gave a rough location (within about {status.roughKm} km), so this may be a nearby area. </>}
            Please check it, then type your house and street.
          </p>
        )}
        {status.kind === "problem" && <p className="mt-3 font-semibold">{status.message}</p>}
      </div>
    </div>
  );
}
