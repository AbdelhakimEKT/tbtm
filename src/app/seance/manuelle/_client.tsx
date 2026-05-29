"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, X } from "lucide-react";
import type { Muscle } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { MUSCLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { createManualSeance } from "@/app/seance/_actions";

export type ExerciceOption = {
  id: string;
  nom: string;
  isLeste: boolean;
  muscles: Muscle[];
};

type SetRow = {
  poidsKg: string;
  bwPlusKg: string;
  reps: string;
};

type ExoRow = {
  exo: ExerciceOption;
  sets: SetRow[];
};

function emptySet(): SetRow {
  return { poidsKg: "", bwPlusKg: "", reps: "" };
}

function todayLocalDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ManualSeanceForm({
  exercices,
}: {
  exercices: ExerciceOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(todayLocalDateInput());
  const [notes, setNotes] = useState("");
  const [exos, setExos] = useState<ExoRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const usedIds = useMemo(() => new Set(exos.map((e) => e.exo.id)), [exos]);

  function addExo(exo: ExerciceOption) {
    if (usedIds.has(exo.id)) return;
    setExos((prev) => [...prev, { exo, sets: [emptySet()] }]);
    setPickerOpen(false);
  }

  function removeExo(idx: number) {
    setExos((prev) => prev.filter((_, i) => i !== idx));
  }

  function addSet(exoIdx: number) {
    setExos((prev) =>
      prev.map((e, i) =>
        i === exoIdx ? { ...e, sets: [...e.sets, emptySet()] } : e,
      ),
    );
  }

  function removeSet(exoIdx: number, setIdx: number) {
    setExos((prev) =>
      prev.map((e, i) => {
        if (i !== exoIdx) return e;
        if (e.sets.length === 1) return e;
        return { ...e, sets: e.sets.filter((_, j) => j !== setIdx) };
      }),
    );
  }

  function updateSet(
    exoIdx: number,
    setIdx: number,
    key: keyof SetRow,
    value: string,
  ) {
    setExos((prev) =>
      prev.map((e, i) => {
        if (i !== exoIdx) return e;
        return {
          ...e,
          sets: e.sets.map((s, j) =>
            j === setIdx ? { ...s, [key]: value } : s,
          ),
        };
      }),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (exos.length === 0) {
      toast.error("Ajoute au moins un exercice");
      return;
    }

    // Convertit en payload pour l'action serveur
    const payload = {
      date: new Date(date),
      notes: notes.trim() || null,
      exercices: exos.map((e) => ({
        exerciceId: e.exo.id,
        sets: e.sets
          .map((s) => ({
            poidsKg: s.poidsKg === "" ? 0 : Number(s.poidsKg),
            bwPlusKg:
              e.exo.isLeste && s.bwPlusKg !== "" ? Number(s.bwPlusKg) : null,
            reps: s.reps === "" ? 0 : Number(s.reps),
          }))
          .filter((s) => s.reps > 0), // ignore les sets vides
      })),
    };

    const emptyExos = payload.exercices.filter((e) => e.sets.length === 0);
    if (emptyExos.length > 0) {
      toast.error("Chaque exercice doit avoir au moins une série avec des reps");
      return;
    }

    startTransition(async () => {
      const res = await createManualSeance(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Séance ajoutée à ton historique");
      router.push(`/seance/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Date */}
      <Card className="flex flex-col gap-1.5">
        <CardLabel>Date</CardLabel>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={todayLocalDateInput()}
          required
          className="h-11 rounded-lg border border-card-border bg-bg px-3 text-sm outline-none focus:border-accent"
        />
      </Card>

      {/* Exos */}
      {exos.length === 0 && (
        <Card className="text-center">
          <p className="text-xs text-muted-strong">
            Aucun exercice. Ajoutes-en un pour commencer.
          </p>
        </Card>
      )}

      {exos.map((row, exoIdx) => (
        <Card key={row.exo.id} className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.exo.nom}</p>
              <p className="text-[10px] text-muted">
                {row.exo.muscles
                  .slice(0, 3)
                  .map((m) => MUSCLE_LABEL[m])
                  .join(", ")}
                {row.exo.isLeste && " · lestable"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeExo(exoIdx)}
              aria-label={`Retirer ${row.exo.nom}`}
              className="grid size-7 shrink-0 place-items-center rounded-full border border-card-border text-muted hover:border-danger/40 hover:text-danger"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[24px_1fr_1fr_24px] items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
              <span>#</span>
              <span>{row.exo.isLeste ? "BW + kg" : "Poids (kg)"}</span>
              <span>Reps</span>
              <span aria-hidden></span>
            </div>
            {row.sets.map((set, setIdx) => (
              <div
                key={setIdx}
                className="grid grid-cols-[24px_1fr_1fr_24px] items-center gap-1.5"
              >
                <span className="text-[11px] text-muted">{setIdx + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  placeholder={row.exo.isLeste ? "+0" : "0"}
                  value={row.exo.isLeste ? set.bwPlusKg : set.poidsKg}
                  onChange={(e) =>
                    updateSet(
                      exoIdx,
                      setIdx,
                      row.exo.isLeste ? "bwPlusKg" : "poidsKg",
                      e.target.value,
                    )
                  }
                  className="h-9 rounded-md border border-card-border bg-bg px-2 text-sm outline-none focus:border-accent"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={set.reps}
                  onChange={(e) =>
                    updateSet(exoIdx, setIdx, "reps", e.target.value)
                  }
                  className="h-9 rounded-md border border-card-border bg-bg px-2 text-sm outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => removeSet(exoIdx, setIdx)}
                  aria-label="Retirer la série"
                  disabled={row.sets.length === 1}
                  className="grid size-6 place-items-center rounded text-muted hover:text-danger disabled:opacity-30"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => addSet(exoIdx)}
            className="inline-flex items-center justify-center gap-1 self-start text-[11px] text-accent-soft hover:underline"
          >
            <Plus className="size-3" /> Ajouter une série
          </button>
        </Card>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => setPickerOpen(true)}
        className="w-full"
      >
        <Plus className="size-4" /> Ajouter un exercice
      </Button>

      {/* Notes */}
      <Card className="flex flex-col gap-1.5">
        <CardLabel>Notes (optionnel)</CardLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Ressenti, contexte, blessure…"
          className="rounded-lg border border-card-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </Card>

      <Button type="submit" size="lg" disabled={pending || exos.length === 0}>
        {pending ? "Enregistrement…" : "Enregistrer la séance"}
      </Button>

      {pickerOpen && (
        <ExoPicker
          exercices={exercices}
          usedIds={usedIds}
          onClose={() => setPickerOpen(false)}
          onPick={addExo}
        />
      )}
    </form>
  );
}

function ExoPicker({
  exercices,
  usedIds,
  onClose,
  onPick,
}: {
  exercices: ExerciceOption[];
  usedIds: Set<string>;
  onClose: () => void;
  onPick: (exo: ExerciceOption) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercices;
    return exercices.filter(
      (e) =>
        e.nom.toLowerCase().includes(q) ||
        e.muscles.some((m) => MUSCLE_LABEL[m].toLowerCase().includes(q)),
    );
  }, [exercices, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col gap-3 rounded-t-2xl border border-card-border-strong bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Choisir un exercice</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-8 place-items-center rounded-full text-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="h-10 w-full rounded-lg border border-card-border bg-bg pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <ul className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <li className="py-4 text-center text-xs text-muted">
              Aucun exercice trouvé.
            </li>
          )}
          {filtered.map((e) => {
            const taken = usedIds.has(e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onPick(e)}
                  disabled={taken}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-bg",
                    taken && "opacity-40",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{e.nom}</p>
                    <p className="truncate text-[10px] text-muted">
                      {e.muscles
                        .slice(0, 3)
                        .map((m) => MUSCLE_LABEL[m])
                        .join(", ")}
                    </p>
                  </div>
                  {taken && (
                    <span className="shrink-0 text-[10px] text-muted">déjà ajouté</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
