"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Utensils } from "lucide-react";
import type { Repas } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { REPAS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";

import { createNutritionLog } from "@/app/nutrition/_actions";

const REPAS_ORDER: Repas[] = [
  "PETIT_DEJEUNER",
  "DEJEUNER",
  "DINER",
  "COLLATION",
];

export function LogRecipeButton({
  recetteId,
  recetteNom,
}: {
  recetteId: string;
  recetteNom: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [repas, setRepas] = useState<Repas>(() => {
    const h = new Date().getHours();
    if (h < 10) return "PETIT_DEJEUNER";
    if (h < 15) return "DEJEUNER";
    if (h < 20) return "DINER";
    return "COLLATION";
  });
  const [portions, setPortions] = useState("1");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleLog() {
    setError(null);
    setSuccess(false);
    const n = Number(portions);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Nombre de portions invalide");
      return;
    }
    startTransition(async () => {
      const res = await createNutritionLog({
        date: new Date(),
        repas,
        portionType: "UNITE",
        quantite: n,
        recetteId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
        router.refresh();
      }, 800);
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="md"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        <Utensils className="size-4" />
        Logger dans mon repas
      </Button>
    );
  }

  return (
    <Card highlighted className="flex flex-col gap-3">
      <div>
        <CardLabel>Logger « {recetteNom} »</CardLabel>
        <p className="mt-0.5 text-[10px] text-muted-strong">
          Aujourd&apos;hui. Les macros sont calculées depuis les ingrédients.
        </p>
      </div>

      <div>
        <CardLabel className="mb-1.5">Repas</CardLabel>
        <div className="grid grid-cols-4 gap-1">
          {REPAS_ORDER.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRepas(r)}
              className={cn(
                "rounded-md border px-1 py-1.5 text-[10px] font-medium transition-colors",
                repas === r
                  ? "border-accent-border bg-accent-bg text-accent-soft"
                  : "border-card-border bg-bg text-muted-strong",
              )}
            >
              {REPAS_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <CardLabel className="mb-1.5">Nombre de portions</CardLabel>
        <input
          type="number"
          min={0.5}
          step="any"
          value={portions}
          onChange={(e) => setPortions(e.target.value)}
          className="h-10 w-24 rounded-md border border-card-border bg-bg px-3 text-sm outline-none focus:border-accent"
        />
      </div>

      {error && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={handleLog}
          disabled={pending}
        >
          {success ? (
            <>
              <Check className="size-4" /> Loggé !
            </>
          ) : pending ? (
            "Log…"
          ) : (
            "Logger"
          )}
        </Button>
      </div>
    </Card>
  );
}
