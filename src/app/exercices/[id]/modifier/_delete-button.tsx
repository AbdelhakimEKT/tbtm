"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deleteExercice } from "../../_actions";

export function DeleteExerciceButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      // auto-reset si l'user n'enchaîne pas
      setTimeout(() => setConfirming(false), 3500);
      return;
    }
    startTransition(async () => {
      const result = await deleteExercice(id);
      // redirect() lance une exception qu'on ne capture pas — on n'arrive ici
      // que si l'action a renvoyé une erreur métier
      if (result && !result.ok) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={
          confirming
            ? "inline-flex h-9 items-center gap-1.5 rounded-full bg-danger px-3 text-xs font-medium text-white"
            : "inline-flex h-9 items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-3 text-xs text-danger"
        }
      >
        <Trash2 className="size-3.5" />
        {confirming ? "Confirmer ?" : "Supprimer"}
      </button>
      {error && <span className="max-w-[200px] text-right text-[10px] text-danger">{error}</span>}
    </div>
  );
}
