"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Flame, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

import { setActiveProgramme } from "../_actions";

export function ActiveToggle({
  programmeId,
  isActive,
  hasExercices,
}: {
  programmeId: string;
  isActive: boolean;
  hasExercices: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    startTransition(async () => {
      const res = await setActiveProgramme(programmeId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (isActive) {
    return (
      <Card highlighted className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-full bg-accent text-white">
          <Flame className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-accent-soft">
            Dans ma rotation <Check className="-mt-0.5 ml-0.5 inline size-3.5" />
          </p>
          <p className="text-[11px] text-muted">
            Affiché sur ta home, prêt à lancer.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          className="text-[11px] text-muted-strong underline-offset-2 hover:text-fg hover:underline disabled:opacity-50"
        >
          Retirer
        </button>
      </Card>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending || !hasExercices}
      className={cn(
        "flex w-full items-center gap-3 rounded-[14px] border border-card-border-strong bg-card p-3 text-left transition-colors",
        hasExercices ? "hover:border-accent-border hover:bg-accent-bg" : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="grid size-9 place-items-center rounded-full bg-accent-bg text-accent-soft">
        <Zap className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {pending ? "Ajout…" : "Ajouter à ma rotation"}
        </p>
        <p className="text-[11px] text-muted">
          {hasExercices
            ? "Tu pourras le lancer en un tap depuis ta home"
            : "Ajoute au moins un exercice d'abord"}
        </p>
      </div>
      <span className="text-[10px] text-muted">→</span>

      {error && (
        <span className="absolute mt-12 text-[10px] text-danger">{error}</span>
      )}
    </button>
  );
}
