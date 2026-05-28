"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Materiel, Muscle } from "@prisma/client";
import { Check, ChevronLeft, Plus, Search } from "lucide-react";

import { MATERIEL_LABEL, MUSCLE_LABEL } from "@/lib/labels";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { addExerciceToProgramme } from "../../_actions";

type ExerciceItem = {
  id: string;
  nom: string;
  muscles: Muscle[];
  materiel: Materiel[];
  isLeste: boolean;
};

export function AddExerciceClient({
  programmeId,
  exercices,
}: {
  programmeId: string;
  exercices: ExerciceItem[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<ExerciceItem | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return exercices;
    return exercices.filter((e) => e.nom.toLowerCase().includes(term));
  }, [exercices, q]);

  if (!picked) {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-lg border border-card-border bg-card px-3 focus-within:border-accent">
          <Search className="size-4 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un exercice…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted"
            autoFocus
          />
        </label>

        <p className="text-[10px] text-muted">
          {filtered.length} exercice{filtered.length > 1 ? "s" : ""} dispo ·{" "}
          <Link
            href="/exercices/nouveau"
            className="text-accent-soft hover:underline"
          >
            crée le tien
          </Link>
        </p>

        <ul className="flex flex-col gap-1.5">
          {filtered.map((exo) => (
            <li key={exo.id}>
              <button
                type="button"
                onClick={() => setPicked(exo)}
                className="block w-full text-left"
              >
                <Card className="transition-colors hover:border-accent-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{exo.nom}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {exo.muscles.slice(0, 3).map((m) => (
                          <span
                            key={m}
                            className="rounded-full bg-accent-bg px-1.5 py-0.5 text-[9px] text-accent-soft"
                          >
                            {MUSCLE_LABEL[m]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="shrink-0 text-[10px] text-muted">
                      {exo.materiel.map((m) => MATERIEL_LABEL[m]).join(", ")}
                    </p>
                  </div>
                </Card>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <Card className="py-6 text-center text-xs text-muted-strong">
              Aucun exercice ne matche
            </Card>
          )}
        </ul>
      </div>
    );
  }

  return (
    <ParamsStep
      exo={picked}
      programmeId={programmeId}
      onBack={() => setPicked(null)}
      onAdded={() => {
        router.push(`/programmes/${programmeId}`);
        router.refresh();
      }}
    />
  );
}

function ParamsStep({
  exo,
  programmeId,
  onBack,
  onAdded,
}: {
  exo: ExerciceItem;
  programmeId: string;
  onBack: () => void;
  onAdded: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [series, setSeries] = useState("3");
  const [reps, setReps] = useState("8");
  const [poids, setPoids] = useState("");
  const [bw, setBw] = useState("");
  const [recup, setRecup] = useState("90");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("exerciceId", exo.id);
    fd.set("seriesCibles", series);
    fd.set("repsCibles", reps);
    if (exo.isLeste) {
      if (bw) fd.set("bwPlusKg", bw);
      if (poids) fd.set("poidsCible", poids);
    } else {
      if (poids) fd.set("poidsCible", poids);
    }
    fd.set("tempsRecupSec", recup);
    if (notes) fd.set("notes", notes);

    startTransition(async () => {
      const res = await addExerciceToProgramme(programmeId, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onAdded();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card highlighted className="flex items-center gap-2">
        <Check className="size-4 text-accent-soft" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{exo.nom}</p>
          <p className="text-[10px] text-muted">
            {exo.muscles.map((m) => MUSCLE_LABEL[m]).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-0.5 text-[11px] text-muted-strong hover:text-fg"
        >
          <ChevronLeft className="size-3" /> Changer
        </button>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Séries" required>
          <input
            type="number"
            min={1}
            max={20}
            required
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Reps par série" required>
          <input
            type="number"
            min={1}
            max={100}
            required
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
          />
        </Field>

        {exo.isLeste ? (
          <>
            <Field label="Lest (kg)" help="poids ajouté au BW">
              <input
                type="number"
                min={0}
                max={500}
                step="any"
                value={bw}
                onChange={(e) => setBw(e.target.value)}
                placeholder="0"
                className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
              />
            </Field>
            <Field label="Récup (sec)" required>
              <input
                type="number"
                min={0}
                max={900}
                step="any"
                required
                value={recup}
                onChange={(e) => setRecup(e.target.value)}
                className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Poids (kg)" help="vide = pas de charge">
              <input
                type="number"
                min={0}
                max={1000}
                step="any"
                value={poids}
                onChange={(e) => setPoids(e.target.value)}
                placeholder="—"
                className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
              />
            </Field>
            <Field label="Récup (sec)" required>
              <input
                type="number"
                min={0}
                max={900}
                step="any"
                required
                value={recup}
                onChange={(e) => setRecup(e.target.value)}
                className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
              />
            </Field>
          </>
        )}
      </div>

      <Field label="Notes (optionnel)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="ex. pyramide, drop set, tempo modifié…"
          className="rounded-lg border border-card-border bg-card p-3 text-xs leading-relaxed outline-none focus:border-accent"
        />
      </Field>

      {error && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        <Plus className="size-4" />
        {pending ? "Ajout…" : "Ajouter au programme"}
      </Button>
    </form>
  );
}

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <CardLabel>
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </CardLabel>
      {children}
      {help && <span className="text-[10px] text-muted">{help}</span>}
    </div>
  );
}
