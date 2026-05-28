"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ShareSeanceButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "T'es bon tu montes", text });
        return;
      } catch {
        // l'utilisateur a annulé ou le navigateur n'a finalement pas pu
      }
    }
    // Fallback : copie dans le presse-papiers
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // tant pis
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      onClick={handleClick}
      className="w-full"
    >
      {copied ? (
        <>
          <Check className="size-4 text-success" /> Copié !
        </>
      ) : (
        <>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <Share2 className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}
          Partager
        </>
      )}
    </Button>
  );
}
