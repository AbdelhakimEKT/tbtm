"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Globe, Lock, Pencil, Users } from "lucide-react";
import type { CategorieRecette, Visibilite } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import {
  CATEGORIE_RECETTE_LABEL,
  VISIBILITE_LABEL,
} from "@/lib/labels";
import { cn } from "@/lib/cn";

import { createRecette, updateRecette } from "./_actions";

export type RecetteFormValues = {
  id?: string;
  nom: string;
  description: string | null;
  portions: number;
  tempsPrepMin: number | null;
  categorie: CategorieRecette;
  visibilite: Visibilite;
  photo: string | null;
  macrosManuelles?: boolean;
  caloriesPortion?: number | null;
  proteinesPortion?: number | null;
  glucidesPortion?: number | null;
  lipidesPortion?: number | null;
};

const VISIBILITE_ICON: Record<Visibilite, React.ComponentType<{ className?: string }>> = {
  PRIVE: Lock,
  AMIS: Users,
  COMMUNAUTE: Globe,
};

export function RecetteForm({
  initial,
  mode,
}: {
  initial?: Partial<RecetteFormValues>;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [portions, setPortions] = useState(
    initial?.portions != null ? String(initial.portions) : "1",
  );
  const [tempsPrepMin, setTempsPrepMin] = useState(
    initial?.tempsPrepMin != null ? String(initial.tempsPrepMin) : "",
  );
  const [categorie, setCategorie] = useState<CategorieRecette>(
    initial?.categorie ?? "PLAT",
  );
  const [visibilite, setVisibilite] = useState<Visibilite>(
    initial?.visibilite ?? "PRIVE",
  );
  const [photo, setPhoto] = useState(initial?.photo ?? "");

  const [macrosManuelles, setMacrosManuelles] = useState(
    initial?.macrosManuelles ?? false,
  );
  const [caloriesPortion, setCaloriesPortion] = useState(
    initial?.caloriesPortion != null ? String(initial.caloriesPortion) : "",
  );
  const [proteinesPortion, setProteinesPortion] = useState(
    initial?.proteinesPortion != null ? String(initial.proteinesPortion) : "",
  );
  const [glucidesPortion, setGlucidesPortion] = useState(
    initial?.glucidesPortion != null ? String(initial.glucidesPortion) : "",
  );
  const [lipidesPortion, setLipidesPortion] = useState(
    initial?.lipidesPortion != null ? String(initial.lipidesPortion) : "",
  );

  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("nom", nom);
    if (description) fd.set("description", description);
    fd.set("portions", portions);
    if (tempsPrepMin) fd.set("tempsPrepMin", tempsPrepMin);
    fd.set("categorie", categorie);
    fd.set("visibilite", visibilite);
    if (photo) fd.set("photo", photo);

    if (macrosManuelles) {
      fd.set("macrosManuelles", "on");
      if (caloriesPortion) fd.set("caloriesPortion", caloriesPortion);
      if (proteinesPortion) fd.set("proteinesPortion", proteinesPortion);
      if (glucidesPortion) fd.set("glucidesPortion", glucidesPortion);
      if (lipidesPortion) fd.set("lipidesPortion", lipidesPortion);
    }

    startTransition(async () => {
      const res =
        mode === "edit" && initial?.id
          ? await updateRecette(initial.id, fd)
          : await createRecette(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/recettes/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Nom" required>
        <input
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="ex. Bowl protéiné poulet riz"
          className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
        />
      </Field>

      <Field label="Description">
        <textarea
          rows={3}
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Instructions, conseils, variations…"
          className="min-h-20 rounded-lg border border-card-border bg-card p-3 text-sm leading-relaxed outline-none focus:border-accent"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Portions" required>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            step="any"
            required
            value={portions}
            onChange={(e) => setPortions(e.target.value)}
            className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Temps prep (min)">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            step="any"
            value={tempsPrepMin}
            onChange={(e) => setTempsPrepMin(e.target.value)}
            placeholder="ex. 25"
            className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
          />
        </Field>
      </div>

      <Field label="Catégorie">
        <select
          value={categorie}
          onChange={(e) => setCategorie(e.target.value as CategorieRecette)}
          className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
        >
          {(Object.keys(CATEGORIE_RECETTE_LABEL) as CategorieRecette[]).map(
            (c) => (
              <option key={c} value={c}>
                {CATEGORIE_RECETTE_LABEL[c]}
              </option>
            ),
          )}
        </select>
      </Field>

      <Field label="Photo (URL, optionnel)">
        <input
          type="url"
          value={photo}
          onChange={(e) => setPhoto(e.target.value)}
          placeholder="https://…"
          className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
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
                <span className="flex-1 text-sm font-medium">
                  {VISIBILITE_LABEL[v]}
                </span>
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

      {/* Section macros — choix entre mode auto (ingrédients) ou manuel */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <CardLabel className="inline-flex items-center gap-1">
            <ChefHat className="size-3 text-accent-soft" />
            Macros par portion
          </CardLabel>
        </div>

        <div className="flex gap-1 rounded-lg border border-card-border bg-bg/40 p-1">
          <ModeTab
            active={!macrosManuelles}
            onClick={() => setMacrosManuelles(false)}
            label="Auto (depuis ingrédients)"
            sub="Ajoutés après création"
          />
          <ModeTab
            active={macrosManuelles}
            onClick={() => setMacrosManuelles(true)}
            label="Saisie manuelle"
            sub="Je connais déjà les chiffres"
            icon={Pencil}
          />
        </div>

        {macrosManuelles ? (
          <div className="grid grid-cols-2 gap-2">
            <MacroField
              label="kcal"
              value={caloriesPortion}
              onChange={setCaloriesPortion}
              placeholder="650"
            />
            <MacroField
              label="Prot (g)"
              value={proteinesPortion}
              onChange={setProteinesPortion}
              placeholder="35"
            />
            <MacroField
              label="Gluc (g)"
              value={glucidesPortion}
              onChange={setGlucidesPortion}
              placeholder="70"
            />
            <MacroField
              label="Lip (g)"
              value={lipidesPortion}
              onChange={setLipidesPortion}
              placeholder="20"
            />
          </div>
        ) : (
          <p className="text-[10px] text-muted-strong">
            Les macros seront calculées automatiquement depuis les ingrédients
            que tu ajouteras après la création.
          </p>
        )}
      </Card>

      {error && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending
          ? "Enregistrement…"
          : mode === "edit"
            ? "Enregistrer"
            : "Créer la recette"}
      </Button>
    </form>
  );
}

function ModeTab({
  active,
  onClick,
  label,
  sub,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left transition-colors",
        active
          ? "bg-accent text-white shadow-sm shadow-accent/30"
          : "text-muted-strong",
      )}
    >
      <span className="flex items-center gap-1 text-[11px] font-medium leading-tight">
        {Icon && <Icon className="size-2.5" />}
        {label}
      </span>
      <span
        className={cn(
          "text-[9px]",
          active ? "text-white/70" : "text-muted",
        )}
      >
        {sub}
      </span>
    </button>
  );
}

function MacroField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-md border border-card-border bg-bg/40 px-3 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <CardLabel>
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </CardLabel>
      {children}
    </div>
  );
}
