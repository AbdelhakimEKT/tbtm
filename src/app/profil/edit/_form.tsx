"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NiveauActivite, Objectif, Sexe } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { OBJECTIF_LABEL } from "@/lib/labels";

import { updateProfile } from "./_actions";

type Props = {
  initial: {
    pseudo: string;
    email: string;
    poidsKg: number | null;
    tailleCm: number | null;
    age: number | null;
    sexe: Sexe | null;
    niveauActivite: NiveauActivite;
    objectif: Objectif;
    ville: string | null;
  };
};

const OBJECTIF_DESCRIPTIONS: Record<Objectif, string> = {
  PRISE_DE_MASSE: "Gagner du muscle, manger en surplus",
  SECHE: "Perdre du gras, déficit calorique",
  FORCE: "Maximiser la force, séries lourdes",
  FORME_GENERALE: "Rester en forme, sans extrême",
};

const NIVEAU_ACTIVITE_LABEL: Record<NiveauActivite, string> = {
  SEDENTAIRE: "Sédentaire",
  LEGER: "Léger",
  MODERE: "Modéré",
  ACTIF: "Actif",
  TRES_ACTIF: "Très actif",
};

const NIVEAU_ACTIVITE_HELP: Record<NiveauActivite, string> = {
  SEDENTAIRE: "Bureau, peu de marche",
  LEGER: "1-2 séances/sem",
  MODERE: "3-5 séances/sem (défaut)",
  ACTIF: "6-7 séances/sem",
  TRES_ACTIF: "2× par jour ou athlète pro",
};

export function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [pseudo, setPseudo] = useState(initial.pseudo);
  const [poidsKg, setPoidsKg] = useState(
    initial.poidsKg != null ? String(initial.poidsKg) : "",
  );
  const [tailleCm, setTailleCm] = useState(
    initial.tailleCm != null ? String(initial.tailleCm) : "",
  );
  const [age, setAge] = useState(initial.age != null ? String(initial.age) : "");
  const [sexe, setSexe] = useState<Sexe | "">(initial.sexe ?? "");
  const [niveauActivite, setNiveauActivite] = useState<NiveauActivite>(
    initial.niveauActivite,
  );
  const [objectif, setObjectif] = useState<Objectif>(initial.objectif);
  const [ville, setVille] = useState(initial.ville ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const fd = new FormData();
    fd.set("pseudo", pseudo);
    if (poidsKg) fd.set("poidsKg", poidsKg);
    if (tailleCm) fd.set("tailleCm", tailleCm);
    if (age) fd.set("age", age);
    if (sexe) fd.set("sexe", sexe);
    fd.set("niveauActivite", niveauActivite);
    fd.set("objectif", objectif);
    if (ville) fd.set("ville", ville);

    startTransition(async () => {
      const result = await updateProfile(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => router.push("/profil"), 600);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Pseudo" required>
        <input
          type="text"
          required
          minLength={3}
          maxLength={24}
          pattern="[a-zA-Z0-9_\-]+"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
        />
      </Field>

      <Field label="Email" help="Pas modifiable pour l'instant (sécurité).">
        <input
          type="email"
          value={initial.email}
          disabled
          className="h-11 rounded-lg border border-card-border bg-bg/40 px-3 text-sm text-muted outline-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Poids (kg)">
          <input
            type="number"
            min={20}
            max={400}
            step="any"
            value={poidsKg}
            onChange={(e) => setPoidsKg(e.target.value)}
            placeholder="75"
            className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Taille (cm)">
          <input
            type="number"
            min={100}
            max={250}
            value={tailleCm}
            onChange={(e) => setTailleCm(e.target.value)}
            placeholder="175"
            className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Âge">
          <input
            type="number"
            min={10}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="25"
            className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Sexe" help="Pour le calcul TDEE">
          <select
            value={sexe}
            onChange={(e) => setSexe(e.target.value as Sexe | "")}
            className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
          >
            <option value="">—</option>
            <option value="HOMME">Homme</option>
            <option value="FEMME">Femme</option>
            <option value="AUTRE">Autre</option>
          </select>
        </Field>
      </div>

      <Field label="Niveau d'activité">
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(NIVEAU_ACTIVITE_LABEL) as NiveauActivite[]).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNiveauActivite(n)}
              className={
                niveauActivite === n
                  ? "rounded-lg border border-accent-border bg-accent-bg px-2.5 py-2 text-left text-accent-soft"
                  : "rounded-lg border border-card-border bg-card px-2.5 py-2 text-left text-muted-strong"
              }
            >
              <p className="text-xs font-medium">
                {NIVEAU_ACTIVITE_LABEL[n]}
              </p>
              <p className="text-[9px] text-muted">
                {NIVEAU_ACTIVITE_HELP[n]}
              </p>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Objectif">
        <div className="flex flex-col gap-1.5">
          {(Object.keys(OBJECTIF_LABEL) as Objectif[]).map((o) => (
            <label
              key={o}
              className={
                objectif === o
                  ? "flex cursor-pointer items-center gap-3 rounded-lg border border-accent-border bg-accent-bg px-3 py-2.5"
                  : "flex cursor-pointer items-center gap-3 rounded-lg border border-card-border bg-card px-3 py-2.5"
              }
            >
              <input
                type="radio"
                name="objectif"
                value={o}
                checked={objectif === o}
                onChange={() => setObjectif(o)}
                className="sr-only"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{OBJECTIF_LABEL[o]}</p>
                <p className="text-[10px] text-muted">
                  {OBJECTIF_DESCRIPTIONS[o]}
                </p>
              </div>
              <span
                className={
                  objectif === o
                    ? "size-4 rounded-full border-2 border-accent bg-accent"
                    : "size-4 rounded-full border-2 border-card-border-strong"
                }
              />
            </label>
          ))}
        </div>
      </Field>

      <Field label="Ville (optionnel)">
        <input
          type="text"
          maxLength={60}
          value={ville}
          onChange={(e) => setVille(e.target.value)}
          placeholder="ex. Orléans"
          className="h-11 rounded-lg border border-card-border bg-card px-3 text-sm outline-none focus:border-accent"
        />
      </Field>

      {error && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
      {success && (
        <Card className="border-success/40 bg-success/10 text-xs text-success">
          Profil enregistré ✓
        </Card>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
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
