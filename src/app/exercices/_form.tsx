"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dynamisme, Materiel, Muscle, Prise } from "@prisma/client";

import {
  DYNAMISME_LABEL,
  MATERIEL_LABEL,
  MUSCLE_GROUP_ORDER,
  MUSCLE_LABEL,
  PRISE_LABEL,
} from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { createExercice, updateExercice } from "./_actions";

export type ExerciceFormValues = {
  id?: string;
  nom: string;
  muscles: Muscle[];
  materiel: Materiel[];
  prise: Prise | null;
  dynamisme: Dynamisme;
  tempo: string | null;
  isLeste: boolean;
  guideExecution: string | null;
};

export function ExerciceForm({
  initial,
  mode,
}: {
  initial?: Partial<ExerciceFormValues>;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [muscles, setMuscles] = useState<Set<Muscle>>(
    new Set(initial?.muscles ?? []),
  );
  const [materiel, setMateriel] = useState<Set<Materiel>>(
    new Set(initial?.materiel ?? []),
  );
  const [prise, setPrise] = useState<Prise | "">(initial?.prise ?? "");
  const [dynamisme, setDynamisme] = useState<Dynamisme>(
    initial?.dynamisme ?? "CONTROLE",
  );
  const [tempo, setTempo] = useState(initial?.tempo ?? "");
  const [isLeste, setIsLeste] = useState(initial?.isLeste ?? false);
  const [guide, setGuide] = useState(initial?.guideExecution ?? "");
  const [error, setError] = useState<string | null>(null);

  function toggleMuscle(m: Muscle) {
    setMuscles((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  }
  function toggleMateriel(m: Materiel) {
    setMateriel((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("nom", nom);
    muscles.forEach((m) => fd.append("muscles", m));
    materiel.forEach((m) => fd.append("materiel", m));
    if (prise) fd.set("prise", prise);
    fd.set("dynamisme", dynamisme);
    if (tempo) fd.set("tempo", tempo);
    if (isLeste) fd.set("isLeste", "on");
    if (guide) fd.set("guideExecution", guide);

    startTransition(async () => {
      const result =
        mode === "edit" && initial?.id
          ? await updateExercice(initial.id, fd)
          : await createExercice(fd);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/exercices/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Nom de l'exercice" required>
        <input
          type="text"
          required
          minLength={2}
          maxLength={60}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="ex. Développé couché incliné"
          className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
        />
      </Field>

      <Field label="Muscles ciblés" required>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_GROUP_ORDER.map((m) => (
            <Chip
              key={m}
              label={MUSCLE_LABEL[m]}
              active={muscles.has(m)}
              onClick={() => toggleMuscle(m)}
            />
          ))}
        </div>
      </Field>

      <Field label="Matériel" required>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(MATERIEL_LABEL) as Materiel[]).map((m) => (
            <Chip
              key={m}
              label={MATERIEL_LABEL[m]}
              active={materiel.has(m)}
              onClick={() => toggleMateriel(m)}
            />
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prise">
          <select
            value={prise}
            onChange={(e) => setPrise(e.target.value as Prise | "")}
            className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
          >
            <option value="">—</option>
            {(Object.keys(PRISE_LABEL) as Prise[]).map((p) => (
              <option key={p} value={p}>
                {PRISE_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dynamisme">
          <select
            value={dynamisme}
            onChange={(e) => setDynamisme(e.target.value as Dynamisme)}
            className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
          >
            {(Object.keys(DYNAMISME_LABEL) as Dynamisme[]).map((d) => (
              <option key={d} value={d}>
                {DYNAMISME_LABEL[d]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Tempo"
        help="Format X-X-X-X : excentrique - pause bas - concentrique - pause haut (ex: 3-1-1-0)"
      >
        <input
          type="text"
          value={tempo}
          onChange={(e) => setTempo(e.target.value)}
          placeholder="3-1-1-0"
          pattern="\d-\d-\d-\d"
          className="h-11 w-32 rounded-lg border border-card-border bg-card px-3 font-mono text-sm outline-none focus:border-accent"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isLeste}
          onChange={(e) => setIsLeste(e.target.checked)}
          className="size-4 rounded border-card-border accent-accent"
        />
        <span>Lestable (poids de corps + charge additionnelle)</span>
      </label>

      <Field
        label="Guide d'exécution"
        help="Une étape par paragraphe. Markdown léger possible."
      >
        <textarea
          value={guide}
          onChange={(e) => setGuide(e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder="Explique step by step comment exécuter le mouvement…"
          className="min-h-32 rounded-lg border border-card-border bg-card p-3 text-sm leading-relaxed outline-none focus:border-accent"
        />
      </Field>

      {error && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending
            ? "Enregistrement…"
            : mode === "edit"
              ? "Enregistrer"
              : "Créer l'exercice"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Annuler
        </Button>
      </div>
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
      <span className="text-xs text-muted-strong">
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </span>
      {children}
      {help && <span className="text-[10px] text-muted">{help}</span>}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-accent-border bg-accent-bg text-accent-soft"
          : "border-card-border bg-bg text-muted-strong hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}
