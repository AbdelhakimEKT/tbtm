"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Settings, X, Zap } from "lucide-react";

import { Card, CardLabel } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  createProgrammesFromTemplate,
  setActiveProgramme,
} from "@/app/programmes/_actions";
import { createSeanceFromProgramme } from "@/app/seance/_actions";
import { useToast } from "@/components/ui/toast";

export type ProgrammeForRotation = {
  id: string;
  nom: string;
  nbExos: number;
  dureeMin: number;
  estActif: boolean;
};

export function RotationCard({
  programmes,
}: {
  programmes: ProgrammeForRotation[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const actifs = programmes.filter((p) => p.estActif);
  const inactifs = programmes.filter((p) => !p.estActif);

  function toggle(id: string) {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      const res = await setActiveProgramme(id);
      setPendingId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  // Aucun programme du tout → onboarding avec templates 1 clic
  if (programmes.length === 0) {
    return <OnboardingEmptyState />;
  }

  return (
    <Card highlighted className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardLabel className="text-accent-soft/80">
          {actifs.length === 0
            ? "Pas de programme actif"
            : actifs.length === 1
              ? "Prochaine séance"
              : "Ma rotation"}
        </CardLabel>
        <span className="text-[10px] text-muted">
          {actifs.length === 0
            ? `${programmes.length} programme${programmes.length > 1 ? "s" : ""}`
            : `${actifs.length} actif${actifs.length > 1 ? "s" : ""} / ${programmes.length}`}
        </span>
      </div>

      {actifs.length === 0 && (
        <p className="text-[11px] text-muted-strong">
          Active au moins un programme pour pouvoir lancer une séance.
        </p>
      )}

      {actifs.length > 1 && (
        <p className="text-[11px] text-muted-strong">
          Choisis ce que tu fais aujourd&apos;hui.
        </p>
      )}

      {/* Programmes actifs */}
      {actifs.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {actifs.map((p) => (
            <RotationItem
              key={p.id}
              programme={p}
              pending={pendingId === p.id}
              onToggle={() => toggle(p.id)}
            />
          ))}
        </ul>
      )}

      {/* Programmes inactifs (max 3 affichés, le reste via lien) */}
      {inactifs.length > 0 && (
        <div className="border-t border-card-border pt-3">
          <CardLabel className="mb-2">
            {actifs.length === 0 ? "Mes programmes" : "Pas dans ma rotation"}
          </CardLabel>
          <ul className="flex flex-col gap-1.5">
            {inactifs.slice(0, 3).map((p) => (
              <RotationItem
                key={p.id}
                programme={p}
                pending={pendingId === p.id}
                onToggle={() => toggle(p.id)}
              />
            ))}
          </ul>
          {inactifs.length > 3 && (
            <Link
              href="/programmes"
              className="mt-2 block text-center text-[11px] text-muted-strong underline-offset-2 hover:underline"
            >
              voir les {inactifs.length - 3} autres →
            </Link>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-[11px] text-danger">
          {error}
        </p>
      )}

      {/* Footer : actions globales */}
      <div className="flex items-center justify-between gap-2 border-t border-card-border pt-3">
        <Link
          href="/programmes/nouveau"
          className="inline-flex items-center gap-1 text-[11px] text-accent-soft hover:underline"
        >
          <Plus className="size-3" /> Nouveau
        </Link>
        <Link
          href="/programmes"
          className="inline-flex items-center gap-1 text-[11px] text-muted-strong hover:text-fg"
        >
          <Settings className="size-3" /> Tous mes programmes
        </Link>
      </div>
    </Card>
  );
}

function RotationItem({
  programme: p,
  pending,
  onToggle,
}: {
  programme: ProgrammeForRotation;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2 transition-opacity",
        p.estActif
          ? "border-card-border-strong bg-bg"
          : "border-card-border bg-bg/40",
        pending && "opacity-50",
      )}
    >
      <Link
        href={`/programmes/${p.id}`}
        className="min-w-0 flex-1 hover:underline"
      >
        <p className="truncate text-xs font-medium">{p.nom}</p>
        <p className="text-[10px] text-muted">
          {p.nbExos} exo{p.nbExos > 1 ? "s" : ""}
          {p.dureeMin > 0 && ` · ~${p.dureeMin} min`}
          {p.nbExos === 0 && " · à compléter"}
        </p>
      </Link>

      {/* Bouton retirer (si actif) */}
      {p.estActif && (
        <button
          type="button"
          aria-label={`Retirer ${p.nom} de la rotation`}
          onClick={onToggle}
          disabled={pending}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-card-border text-muted hover:border-danger/40 hover:text-danger"
        >
          <X className="size-3.5" />
        </button>
      )}

      {/* Bouton ajouter (si inactif) */}
      {!p.estActif && (
        <button
          type="button"
          aria-label={`Ajouter ${p.nom} à la rotation`}
          onClick={onToggle}
          disabled={pending || p.nbExos === 0}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px]",
            p.nbExos === 0
              ? "cursor-not-allowed border-card-border text-muted opacity-50"
              : "border-accent-border bg-accent-bg text-accent-soft hover:border-accent",
          )}
        >
          <Plus className="size-3" />
          {pending ? "..." : "Ajouter"}
        </button>
      )}

      {/* Bouton lancer (si actif et a des exos) */}
      {p.estActif && p.nbExos > 0 && (
        <form action={createSeanceFromProgramme} className="shrink-0">
          <input type="hidden" name="programmeId" value={p.id} />
          <button
            type="submit"
            aria-label={`Lancer ${p.nom}`}
            className="grid size-8 place-items-center rounded-full bg-accent text-white shadow-sm shadow-accent/30 transition-transform active:scale-95"
          >
            <Zap className="size-3.5" />
          </button>
        </form>
      )}
    </li>
  );
}

// ----------------------------------------------------------------------------
// Onboarding empty state — templates 1-clic pour démarrer en 5 sec
// ----------------------------------------------------------------------------

const TEMPLATES = [
  {
    key: "push-pull-legs" as const,
    nom: "Push / Pull / Legs",
    description: "3 séances, split classique 6 jours",
    icon: "💪",
  },
  {
    key: "upper-lower" as const,
    nom: "Upper / Lower",
    description: "2 séances, split 4 jours",
    icon: "🔱",
  },
  {
    key: "full-body" as const,
    nom: "Full body",
    description: "1 séance complète, idéal débutant",
    icon: "🎯",
  },
];

function OnboardingEmptyState() {
  const router = useRouter();
  const toast = useToast();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function pickTemplate(key: string) {
    setPendingKey(key);
    const fd = new FormData();
    fd.set("template", key);
    startTransition(async () => {
      const res = await createProgrammesFromTemplate(fd);
      setPendingKey(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.ids.length} programme${res.ids.length > 1 ? "s" : ""} créé${res.ids.length > 1 ? "s" : ""} 💪`);
      router.refresh();
    });
  }

  return (
    <Card highlighted className="flex flex-col gap-3">
      <CardLabel className="text-accent-soft/80">
        Pour démarrer
      </CardLabel>
      <p className="text-sm">
        Choisis un template prêt-à-l&apos;emploi (exos pré-remplis) ou crée le tien.
      </p>
      <ul className="flex flex-col gap-1.5">
        {TEMPLATES.map((t) => (
          <li key={t.key}>
            <button
              type="button"
              onClick={() => pickTemplate(t.key)}
              disabled={pendingKey !== null}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-card-border bg-bg p-3 text-left transition-colors hover:border-accent-border",
                pendingKey === t.key && "opacity-50",
              )}
            >
              <span className="text-2xl">{t.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.nom}</p>
                <p className="text-[10px] text-muted">{t.description}</p>
              </div>
              <span className="text-[10px] text-accent-soft">
                {pendingKey === t.key ? "..." : "Choisir"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Link
        href="/programmes/nouveau"
        className="text-center text-[11px] text-muted-strong underline-offset-2 hover:underline"
      >
        ou je crée le mien à partir de zéro →
      </Link>
    </Card>
  );
}
