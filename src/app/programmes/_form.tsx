"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Muscle, Visibilite } from "@prisma/client";
import { Globe, Lock, Users } from "lucide-react";

import {
  MUSCLE_GROUP_ORDER,
  MUSCLE_LABEL,
  VISIBILITE_LABEL,
} from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { createProgramme, updateProgramme } from "./_actions";

export type ProgrammeFormValues = {
  id?: string;
  nom: string;
  description: string | null;
  tags: Muscle[];
  visibilite: Visibilite;
  frequenceHebdo: number | null;
};

const VISIBILITE_ICON: Record<Visibilite, React.ComponentType<{ className?: string }>> = {
  PRIVE: Lock,
  AMIS: Users,
  COMMUNAUTE: Globe,
};

const VISIBILITE_HELP: Record<Visibilite, string> = {
  PRIVE: "Toi seul",
  AMIS: "Tes potes seulement",
  COMMUNAUTE: "Tout le monde sur TBTM",
};

export function ProgrammeForm({
  initial,
  mode,
}: {
  initial?: Partial<ProgrammeFormValues>;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState<Set<Muscle>>(new Set(initial?.tags ?? []));
  const [visibilite, setVisibilite] = useState<Visibilite>(
    initial?.visibilite ?? "PRIVE",
  );
  const [frequenceHebdo, setFrequenceHebdo] = useState<string>(
    initial?.frequenceHebdo != null ? String(initial.frequenceHebdo) : "",
  );
  const [error, setError] = useState<string | null>(null);

  function toggleTag(m: Muscle) {
    setTags((prev) => {
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
    if (description) fd.set("description", description);
    tags.forEach((t) => fd.append("tags", t));
    fd.set("visibilite", visibilite);
    if (frequenceHebdo) fd.set("frequenceHebdo", frequenceHebdo);

    startTransition(async () => {
      const result =
        mode === "edit" && initial?.id
          ? await updateProgramme(initial.id, fd)
          : await createProgramme(fd);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/programmes/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Nom du programme" required>
        <input
          type="text"
          required
          minLength={2}
          maxLength={60}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="ex. Push / Pull / Legs"
          className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="C'est quoi le délire ? À qui ça s'adresse ? Combien de séances par semaine ?"
          className="min-h-20 rounded-lg border border-card-border bg-card p-3 text-sm leading-relaxed outline-none focus:border-accent"
        />
      </Field>

      <Field label="Groupes musculaires ciblés">
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_GROUP_ORDER.map((m) => (
            <Chip
              key={m}
              label={MUSCLE_LABEL[m]}
              active={tags.has(m)}
              onClick={() => toggleTag(m)}
            />
          ))}
        </div>
      </Field>

      <Field label="Fréquence hebdomadaire (séances/semaine)">
        <input
          type="number"
          min={1}
          max={14}
          value={frequenceHebdo}
          onChange={(e) => setFrequenceHebdo(e.target.value)}
          placeholder="ex. 4"
          className="h-11 w-24 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
        />
      </Field>

      <Field label="Visibilité">
        <div className="flex flex-col gap-1.5">
          {(Object.keys(VISIBILITE_LABEL) as Visibilite[]).map((v) => {
            const Icon = VISIBILITE_ICON[v];
            return (
              <label
                key={v}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
                  visibilite === v
                    ? "border-accent-border bg-accent-bg"
                    : "border-card-border",
                )}
              >
                <input
                  type="radio"
                  name="visibilite"
                  value={v}
                  checked={visibilite === v}
                  onChange={() => setVisibilite(v)}
                  className="sr-only"
                />
                <Icon className="size-4 text-accent-soft" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{VISIBILITE_LABEL[v]}</p>
                  <p className="text-[10px] text-muted">{VISIBILITE_HELP[v]}</p>
                </div>
                <span
                  className={cn(
                    "size-4 rounded-full border-2",
                    visibilite === v
                      ? "border-accent bg-accent"
                      : "border-card-border-strong",
                  )}
                />
              </label>
            );
          })}
        </div>
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
              : "Créer le programme"}
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
