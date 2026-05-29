"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { deleteSeance } from "@/app/seance/_actions";

export function DeleteSeanceButton({ seanceId }: { seanceId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteSeance(seanceId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Séance supprimée");
      router.push("/");
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-2 inline-flex items-center justify-center gap-1 self-center text-[11px] text-muted hover:text-danger"
      >
        <Trash2 className="size-3" /> Supprimer cette séance
      </button>
    );
  }

  return (
    <Card className="mt-2 flex flex-col gap-2 border-danger/40 bg-danger/5">
      <p className="text-xs text-fg">
        Supprimer cette séance ? L&apos;XP et la streak déjà gagnés ne sont pas
        recalculés.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="flex-1"
        >
          Annuler
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={pending}
          className="flex-1"
        >
          {pending ? "Suppression…" : "Confirmer"}
        </Button>
      </div>
    </Card>
  );
}
