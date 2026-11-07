"use client";

import Link from "next/link";
import { useState } from "react";
import { addToBag } from "@/components/cart/bag-store";
import { Button } from "@/components/ui/Button";
import { FinishPicker } from "./FinishPicker";

const messages = {
  limit: "That's the most of this piece one bag can hold.",
  full: "Your bag is full. Remove something to add this piece.",
};

export function AddToBag({ slug, name, finishes, soldOut }: { slug: string; name: string; finishes: string[]; soldOut?: boolean }) {
  const [finish, setFinish] = useState(finishes[0]);
  const [status, setStatus] = useState<{ added: boolean; text: string } | null>(null);

  const add = () => {
    const result = addToBag(slug, finish);
    setStatus(result === "added" ? { added: true, text: `Added ${name}, ${finish}.` } : { added: false, text: messages[result] });
  };

  return (
    <>
      <div className="mt-6">
        <FinishPicker finishes={finishes} value={finish} onChange={(next) => { setFinish(next); setStatus(null); }} />
      </div>
      <div className="mt-6">
        {soldOut ? (
          <Button disabled className="min-h-12 w-full cursor-not-allowed !bg-ink-soft text-center !text-ivory !opacity-100">Sold out</Button>
        ) : (
          <Button onClick={add} className="min-h-12 w-full">Add to bag</Button>
        )}
        <p role="status" className="mt-3 min-h-5 text-sm">
          {status && (
            <>
              {status.text}
              {status.added && <> <Link prefetch={false} href="/bag" className="font-semibold underline decoration-gold underline-offset-4 hover:decoration-espresso">View bag</Link></>}
            </>
          )}
        </p>
      </div>
    </>
  );
}
