import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Flame,
  Globe,
  Lock,
  Pencil,
  Plus,
  Users,
  Zap,
} from "lucide-react";
import type { Visibilite } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardLabel } from "@/components/ui/card";
import { MUSCLE_LABEL, VISIBILITE_LABEL } from "@/lib/labels";

import { createSeanceFromProgramme } from "@/app/seance/_actions";

import { SortableExerciceList } from "./_sortable-list";
import { ProgrammeMenuActions } from "./_menu-actions";
import { ActiveToggle } from "./_active-toggle";

type Params = Promise<{ id: string }>;

const VISIBILITE_ICON: Record<Visibilite, React.ComponentType<{ className?: string }>> = {
  PRIVE: Lock,
  AMIS: Users,
  COMMUNAUTE: Globe,
};

export default async function ProgrammeDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();

  const programme = await prisma.programme.findUnique({
    where: { id },
    select: {
      id: true,
      nom: true,
      description: true,
      tags: true,
      visibilite: true,
      estProgrammeActif: true,
      frequenceHebdo: true,
      createdAt: true,
      createdById: true,
      createdBy: { select: { pseudo: true } },
      exercices: {
        orderBy: { ordre: "asc" },
        select: {
          id: true,
          ordre: true,
          seriesCibles: true,
          repsCibles: true,
          poidsCible: true,
          bwPlusKg: true,
          tempsRecupSec: true,
          notes: true,
          exercice: {
            select: {
              id: true,
              nom: true,
              muscles: true,
              isLeste: true,
            },
          },
        },
      },
    },
  });

  if (!programme) notFound();

  const isOwner = !!session?.user?.id && programme.createdById === session.user.id;
  const isAdmin = session?.user?.role === "ADMIN";
  const canEdit = isOwner || isAdmin;

  // Si pas owner et programme privé, on bloque
  if (!isOwner && !isAdmin && programme.visibilite === "PRIVE") {
    redirect("/programmes");
  }

  const VisibIcon = VISIBILITE_ICON[programme.visibilite];
  const totalSeries = programme.exercices.reduce((acc, e) => acc + e.seriesCibles, 0);
  const dureeEstimee = estimerDuree(programme.exercices);

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/programmes"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <ProgrammeMenuActions
          programmeId={programme.id}
          canEdit={canEdit}
          isOwner={isOwner}
          isActive={programme.estProgrammeActif}
          isLoggedIn={!!session?.user?.id}
        />
      </header>

      <section>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold leading-tight">
              {programme.nom}
            </h1>
            <p className="mt-1 text-[11px] text-muted">
              par {programme.createdBy.pseudo} ·{" "}
              {programme.createdAt.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          {programme.estProgrammeActif && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent-soft">
              <Flame className="size-3" />
              Actif
            </span>
          )}
        </div>

        {programme.description && (
          <p className="mt-3 text-sm text-muted-strong">{programme.description}</p>
        )}

        {programme.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {programme.tags.map((m) => (
              <span
                key={m}
                className="rounded-full bg-accent-bg px-2.5 py-0.5 text-[11px] text-accent-soft"
              >
                {MUSCLE_LABEL[m]}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2">
        <Card className="flex flex-col items-center gap-0.5 py-3 text-center">
          <CardLabel>Exercices</CardLabel>
          <p className="text-lg font-medium">{programme.exercices.length}</p>
        </Card>
        <Card className="flex flex-col items-center gap-0.5 py-3 text-center">
          <CardLabel>Séries</CardLabel>
          <p className="text-lg font-medium">{totalSeries}</p>
        </Card>
        <Card className="flex flex-col items-center gap-0.5 py-3 text-center">
          <CardLabel>Durée</CardLabel>
          <p className="text-lg font-medium">~{dureeEstimee} min</p>
        </Card>
      </section>

      <section className="mt-4 flex items-center justify-between rounded-xl border border-card-border bg-card px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-strong">
          <VisibIcon className="size-3.5" />
          <span>{VISIBILITE_LABEL[programme.visibilite]}</span>
          {programme.frequenceHebdo && (
            <>
              <span className="text-muted">·</span>
              <span>{programme.frequenceHebdo} séances/sem</span>
            </>
          )}
        </div>
      </section>

      {isOwner && (
        <div className="mt-3">
          <ActiveToggle
            programmeId={programme.id}
            isActive={programme.estProgrammeActif}
            hasExercices={programme.exercices.length > 0}
          />
        </div>
      )}

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between px-1">
          <CardLabel>Exercices</CardLabel>
          {canEdit && (
            <Link
              href={`/programmes/${programme.id}/ajouter`}
              className="inline-flex items-center gap-1 text-[11px] text-accent-soft hover:underline"
            >
              <Plus className="size-3" /> Ajouter
            </Link>
          )}
        </div>

        {programme.exercices.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm">Programme vide</p>
            <p className="text-[11px] text-muted-strong">
              {canEdit
                ? "Ajoute tes premiers exos pour pouvoir lancer une séance."
                : "Le créateur n'a pas encore ajouté d'exercices."}
            </p>
            {canEdit && (
              <Link
                href={`/programmes/${programme.id}/ajouter`}
                className="mt-2 inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white"
              >
                <Plus className="size-4" /> Ajouter un exercice
              </Link>
            )}
          </Card>
        ) : (
          <SortableExerciceList
            programmeId={programme.id}
            canEdit={canEdit}
            items={programme.exercices}
          />
        )}
      </section>

      {programme.exercices.length > 0 && (
        <div className="mt-6 sticky bottom-16 px-1">
          <form action={createSeanceFromProgramme}>
            <input type="hidden" name="programmeId" value={programme.id} />
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-white shadow-lg shadow-accent/30 transition-transform active:scale-[0.98]"
            >
              Lancer la séance <Zap className="size-4" />
            </button>
          </form>
        </div>
      )}

      {programme.exercices.length > 0 && isOwner && (
        <Link
          href={`/defis/nouveau?programme=${programme.id}`}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-accent-border bg-accent-bg/30 px-4 py-2.5 text-xs font-medium text-accent-soft hover:bg-accent-bg/50"
        >
          <Zap className="size-3.5" /> Défier mes potes sur ce programme
        </Link>
      )}

      {canEdit && (
        <div className="mt-4 flex justify-center gap-2 text-[11px]">
          <Link
            href={`/programmes/${programme.id}/modifier`}
            className="inline-flex items-center gap-1 text-muted-strong hover:text-fg"
          >
            <Pencil className="size-3" /> Modifier les infos
          </Link>
          <span className="text-muted">·</span>
          {isOwner && (
            <Link
              href={`/programmes/${programme.id}/partager`}
              className="inline-flex items-center gap-1 text-muted-strong hover:text-fg"
            >
              <Copy className="size-3" /> Partager
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function estimerDuree(
  exos: { seriesCibles: number; tempsRecupSec: number }[],
): number {
  // Estimation simple : 45s par série + récup, en minutes arrondi
  const seconds = exos.reduce(
    (acc, e) => acc + e.seriesCibles * (45 + e.tempsRecupSec),
    0,
  );
  return Math.max(5, Math.round(seconds / 60));
}
