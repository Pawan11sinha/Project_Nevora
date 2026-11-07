"use client";

import { useId, useState } from "react";

// Works on its own, or controlled by a parent through value and onChange.
export function FinishPicker({ finishes, value, onChange }: { finishes: string[]; value?: string; onChange?: (finish: string) => void }) {
  const [own, setOwn] = useState(finishes[0]);
  const selected = value ?? own;
  const setSelected = (finish: string) => (onChange ? onChange(finish) : setOwn(finish));
  const name = useId();
  return (
    <fieldset>
      <legend className="text-sm font-semibold">Finish: <span className="font-normal">{selected}</span></legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {finishes.map((finish) => (
          <label key={finish} className={`inline-flex min-h-11 cursor-pointer items-center border px-4 text-sm transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-espresso ${selected === finish ? "border-espresso bg-espresso text-ivory" : "border-control hover:bg-cream"}`}>
            <input type="radio" name={name} value={finish} checked={selected === finish} onChange={() => setSelected(finish)} className="sr-only" />
            {finish}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
