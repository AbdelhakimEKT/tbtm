"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { Repas } from "@prisma/client";

import { Card, CardLabel } from "@/components/ui/card";
import { PORTION_LABEL, REPAS_LABEL } from "@/lib/labels";

import { deleteNutritionLog } from "./_actions";

export type LogItem = {
  id: string;
  portionType: keyof typeof PORTION_LABEL;
  quantite: number;
  calories: number;
  proteines: number;
  glucides: number;
  lipides: number;
  ingredient: { id: string; nom: string; photo: string | null } | null;
  recette: { id: string; nom: string; photo: string | null } | null;
};

export function MealSection({
  repas,
  date,
  items,
}: {
  repas: Repas;
  date: string;
  items: LogItem[];
}) {
  const totalCalories = items.reduce((acc, i) => acc + i.calories, 0);
  const totalProt = items.reduce((acc, i) => acc + i.proteines, 0);

  return (
    <section className="mt-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <CardLabel>
          {REPAS_LABEL[repas]} {items.length > 0 && `· ${Math.round(totalCalories)} kcal`}
        </CardLabel>
        <Link
          href={`/nutrition/ajouter?repas=${repas}&date=${date}`}
          className="inline-flex items-center gap-1 text-[11px] text-accent-soft hover:underline"
        >
          <Plus className="size-3" /> Ajouter
        </Link>
      </div>
      {items.length === 0 ? (
        <Card className="py-3 text-center text-[11px] text-muted-strong">
          Rien de loggué pour ce repas
        </Card>
      ) : (
        <Card className="flex flex-col gap-1.5">
          {items.map((it) => (
            <LogRow key={it.id} item={it} />
          ))}
          {items.length > 1 && (
            <p className="mt-1 text-right text-[10px] text-muted">
              Total : {Math.round(totalCalories)} kcal · {Math.round(totalProt)}g prot
            </p>
          )}
        </Card>
      )}
    </section>
  );
}

function LogRow({ item }: { item: LogItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const nom = item.ingredient?.nom ?? item.recette?.nom ?? "Inconnu";
  const photo = item.ingredient?.photo ?? item.recette?.photo;

  function handleDelete() {
    if (!confirm(`Supprimer "${nom}" ?`)) return;
    startTransition(async () => {
      await deleteNutritionLog(item.id);
      router.refresh();
    });
  }

  return (
    <div
      className={
        pending
          ? "flex items-center gap-3 rounded-lg bg-bg px-2.5 py-2 opacity-50"
          : "flex items-center gap-3 rounded-lg bg-bg px-2.5 py-2"
      }
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          className="size-9 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-bg text-[11px] font-medium text-accent-soft">
          {nom.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{nom}</p>
        <p className="text-[10px] text-muted">
          {item.quantite} {PORTION_LABEL[item.portionType].toLowerCase()}
          {item.quantite > 1 && item.portionType !== "GRAMMES" && "s"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-medium">{Math.round(item.calories)} kcal</p>
        <p className="text-[10px] text-muted">
          P{Math.round(item.proteines)} G{Math.round(item.glucides)} L{Math.round(item.lipides)}
        </p>
      </div>
      <button
        type="button"
        aria-label="Supprimer"
        onClick={handleDelete}
        disabled={pending}
        className="shrink-0 text-muted hover:text-danger"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
