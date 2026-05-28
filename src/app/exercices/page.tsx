import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { Prisma, Muscle, Materiel } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MATERIEL_LABEL,
  MUSCLE_GROUP_ORDER,
  MUSCLE_LABEL,
} from "@/lib/labels";
import { Card, CardLabel } from "@/components/ui/card";

import { ExerciceFilters } from "./_filters";

const PARAM_TO_ENUM_MUSCLE = Object.fromEntries(
  MUSCLE_GROUP_ORDER.map((m) => [m.toLowerCase(), m]),
) as Record<string, Muscle>;

const PARAM_TO_ENUM_MATERIEL = Object.fromEntries(
  Object.keys(MATERIEL_LABEL).map((m) => [m.toLowerCase(), m as Materiel]),
) as Record<string, Materiel>;

type SearchParams = Promise<{
  q?: string;
  muscle?: string | string[];
  materiel?: string | string[];
}>;

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function parseMuscles(v: string | string[] | undefined): Muscle[] {
  return toArray(v)
    .map((s) => PARAM_TO_ENUM_MUSCLE[s.toLowerCase()])
    .filter(Boolean) as Muscle[];
}

function parseMateriel(v: string | string[] | undefined): Materiel[] {
  return toArray(v)
    .map((s) => PARAM_TO_ENUM_MATERIEL[s.toLowerCase()])
    .filter(Boolean) as Materiel[];
}

export default async function ExercicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const muscles = parseMuscles(params.muscle);
  const materiels = parseMateriel(params.materiel);

  const where: Prisma.ExerciceWhereInput = {
    AND: [
      q ? { nom: { contains: q, mode: "insensitive" } } : {},
      muscles.length ? { muscles: { hasSome: muscles } } : {},
      materiels.length ? { materiel: { hasSome: materiels } } : {},
    ],
  };

  let exercices: Awaited<ReturnType<typeof fetchExercices>> = [];
  let dbError = false;
  try {
    exercices = await fetchExercices(where);
  } catch {
    dbError = true;
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Exercices</h1>
          <p className="mt-0.5 text-[11px] text-muted">
            {dbError
              ? "BDD non connectée"
              : `${exercices.length} exercice${exercices.length > 1 ? "s" : ""} dispo`}
          </p>
        </div>
        <Link
          href="/exercices/nouveau"
          className="inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white shadow-sm shadow-accent/30"
        >
          <Plus className="size-4" /> Nouveau
        </Link>
      </header>

      <ExerciceFilters
        initialQ={q}
        initialMuscles={muscles}
        initialMateriels={materiels}
      />

      <section className="mt-4 flex flex-col gap-2">
        {dbError && (
          <Card className="border-danger/30 bg-danger/5 text-xs text-danger">
            Impossible de charger les exercices. Vérifie que la BDD est branchée
            (DATABASE_URL) et que les migrations ont été poussées.
          </Card>
        )}
        {!dbError && exercices.length === 0 && (
          <Card className="flex flex-col items-center gap-2 py-8 text-center">
            <Search className="size-6 text-muted" />
            <p className="text-sm">Aucun résultat</p>
            <p className="text-[11px] text-muted">
              Élargis la recherche ou{" "}
              <Link href="/exercices/nouveau" className="text-accent-soft underline-offset-2 hover:underline">
                crée un exo
              </Link>
              .
            </p>
          </Card>
        )}
        {exercices.map((e) => (
          <ExerciceCard key={e.id} exercice={e} currentUserId={session?.user?.id} />
        ))}
      </section>
    </div>
  );
}

type ExerciceCardData = Awaited<ReturnType<typeof fetchExercices>>[number];

function ExerciceCard({
  exercice,
  currentUserId,
}: {
  exercice: ExerciceCardData;
  currentUserId?: string;
}) {
  const isMine = currentUserId && exercice.createdById === currentUserId;
  return (
    <Link href={`/exercices/${exercice.id}`}>
      <Card className="transition-colors hover:border-accent-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{exercice.nom}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {exercice.muscles.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-accent-bg px-2 py-0.5 text-[10px] text-accent-soft"
                >
                  {MUSCLE_LABEL[m]}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-muted">
              {exercice.materiel.map((m) => MATERIEL_LABEL[m]).join(" · ")}
            </p>
            {isMine && (
              <span className="mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[9px] uppercase tracking-wide text-accent-soft">
                Toi
              </span>
            )}
            {exercice.isLeste && (
              <span className="mt-1 ml-1 inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[9px] uppercase tracking-wide text-gold">
                Lestable
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

async function fetchExercices(where: Prisma.ExerciceWhereInput) {
  return prisma.exercice.findMany({
    where,
    orderBy: [{ nom: "asc" }],
    select: {
      id: true,
      nom: true,
      muscles: true,
      materiel: true,
      isLeste: true,
      createdById: true,
    },
    take: 200,
  });
}
