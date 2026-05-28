"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ShareControls({
  shareUrl,
  canShare,
  programmeNom,
}: {
  shareUrl: string;
  canShare: boolean;
  programmeNom: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback : sélectionne le texte
    }
  }

  async function handleNativeShare() {
    if (!navigator.share) {
      handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: `Programme TBTM — ${programmeNom}`,
        text: `Mate ce programme : ${programmeNom}`,
        url: shareUrl,
      });
    } catch {
      // L'utilisateur a annulé, ou pas de support
    }
  }

  if (!canShare) {
    return (
      <Card className="mt-3 py-4 text-center">
        <p className="text-xs text-muted-strong">
          Le lien sera dispo une fois la visibilité changée.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-3 flex flex-col gap-3">
      <CardLabel>Lien à partager</CardLabel>
      <div className="flex gap-2">
        <input
          readOnly
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 flex-1 rounded-lg border border-card-border bg-bg px-3 text-[11px] font-mono outline-none"
        />
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copier"
          className="grid size-11 place-items-center rounded-lg border border-card-border bg-card hover:border-accent-border"
        >
          {copied ? (
            <Check className="size-4 text-success" />
          ) : (
            <Copy className="size-4 text-muted-strong" />
          )}
        </button>
      </div>

      <Button onClick={handleNativeShare} size="md" variant="secondary">
        <Share2 className="size-4" />
        Partager via…
      </Button>
      {copied && (
        <p className="text-center text-[10px] text-success">Lien copié ✓</p>
      )}
    </Card>
  );
}
