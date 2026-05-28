"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Number input avec boutons +/- pour ajustements rapides mobile-first.
 * Toujours éditable au clavier pour valeurs custom. Affiche le step à côté du label.
 *
 * Variant compact = utilisable dans une grid serrée (pas de label, hauteur réduite).
 * Variant default = label + box bordurée + boutons 36x36.
 */
export function NumberPicker({
  label,
  value,
  onChange,
  step,
  unit,
  min = 0,
  max,
  variant = "default",
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
  unit?: string;
  min?: number;
  max?: number;
  variant?: "default" | "compact";
  className?: string;
}) {
  function adjust(delta: number) {
    const current = Number(value) || 0;
    let next = Math.round((current + delta) * 100) / 100;
    if (next < min) next = min;
    if (max != null && next > max) next = max;
    onChange(String(next));
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-stretch gap-0.5 rounded-md border border-card-border bg-bg/40 p-0.5",
          className,
        )}
      >
        <button
          type="button"
          aria-label={`-${step}`}
          onClick={() => adjust(-step)}
          className="grid size-7 shrink-0 place-items-center rounded text-muted-strong active:scale-95"
        >
          <Minus className="size-3" />
        </button>
        <div className="relative flex flex-1 items-center justify-center">
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(",", "."))}
            onFocus={(e) => e.currentTarget.select()}
            className="h-7 w-full bg-transparent px-1 text-center text-sm font-medium outline-none"
          />
          {unit && (
            <span className="pointer-events-none absolute right-1 text-[9px] text-muted">
              {unit}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={`+${step}`}
          onClick={() => adjust(step)}
          className="grid size-7 shrink-0 place-items-center rounded bg-accent text-white active:scale-95"
        >
          <Plus className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-[10px] uppercase tracking-wide text-muted">
          {label}
          <span className="ml-1 normal-case text-muted/70">±{step}</span>
        </span>
      )}
      <div className="flex items-stretch gap-1 rounded-lg border border-accent-border bg-bg/40 p-1">
        <button
          type="button"
          aria-label={`-${step}`}
          onClick={() => adjust(-step)}
          className="grid size-9 shrink-0 place-items-center rounded-md bg-card text-muted-strong active:scale-95"
        >
          <Minus className="size-4" />
        </button>
        <div className="relative flex flex-1 items-center justify-center">
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(",", "."))}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 w-full bg-transparent text-center text-base font-semibold outline-none"
          />
          {unit && (
            <span className="pointer-events-none absolute right-1 text-[10px] text-muted">
              {unit}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={`+${step}`}
          onClick={() => adjust(step)}
          className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-white shadow-sm shadow-accent/30 active:scale-95"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
