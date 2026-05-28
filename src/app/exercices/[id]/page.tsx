import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Timer, TrendingUp, Trophy } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DYNAMISME_LABEL,
  MATERIEL_LABEL,
  MUSCLE_LABEL,
  PRISE_LABEL,
} from "@/lib/labels";
import { Card, CardLabel } from "@/components/ui/card";

type Params = Promise<{ id: string }>;

export default async function ExerciceDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();

  const exercice = await safeGetExercice(id);
  if (!exercice) notFound();

  const isMine = session?.user?.id && exercice.createdById === session.user.id;
  const isAdmin = session?.user?.role === "ADMIN";
  const canEdit = isMine || isAdmin;

  // Historique personnel (vide en phase 2, branché en phase 5)
  const historique: {
    date: Date;
    poidsKg: number;
    reps: number;
    estimated1RM: number;
  }[] = [];

  const pr = await safeGetBestPR(session?.user?.id, exercice.id);

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/exercices"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
        {canEdit && (
          <Link
            href={`/exercices/${exercice.id}/modifier`}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-card-border bg-card px-3 text-xs text-muted-strong hover:text-fg"
          >
            <Pencil className="size-3.5" />
            {isMine ? "Modifier" : "Modifier (admin)"}
          </Link>
        )}
      </header>

      <section>
        <h1 className="text-2xl font-semibold leading-tight">{exercice.nom}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {exercice.muscles.map((m) => (
            <span
              key={m}
              className="rounded-full bg-accent-bg px-2.5 py-0.5 text-[11px] text-accent-soft"
            >
              {MUSCLE_LABEL[m]}
            </span>
          ))}
          {exercice.isLeste && (
            <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] text-gold">
              Lestable
            </span>
          )}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2">
        <Card className="flex flex-col gap-0.5">
          <CardLabel>Matériel</CardLabel>
          <p className="text-sm font-medium">
            {exercice.materiel.length
              ? exercice.materiel.map((m) => MATERIEL_LABEL[m]).join(", ")
              : "—"}
          </p>
        </Card>
        <Card className="flex flex-col gap-0.5">
          <CardLabel>Prise</CardLabel>
          <p className="text-sm font-medium">
            {exercice.prise ? PRISE_LABEL[exercice.prise] : "—"}
          </p>
        </Card>
        <Card className="flex flex-col gap-0.5">
          <CardLabel>Dynamisme</CardLabel>
          <p className="text-sm font-medium">{DYNAMISME_LABEL[exercice.dynamisme]}</p>
        </Card>
        <Card className="flex flex-col gap-0.5">
          <CardLabel className="flex items-center gap-1">
            <Timer className="size-3" /> Tempo
          </CardLabel>
          <p className="text-sm font-medium">
            {exercice.tempo ? <span className="font-mono">{exercice.tempo}</span> : "—"}
          </p>
        </Card>
      </section>

      {exercice.guideExecution && (
        <section className="mt-4">
          <CardLabel className="mb-2 px-1">Guide d&apos;exécution</CardLabel>
          <Card>
            <div className="space-y-2 whitespace-pre-line text-sm leading-relaxed text-muted-strong">
              {exercice.guideExecution}
            </div>
          </Card>
        </section>
      )}

      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <CardLabel className="flex items-center gap-1">
            <Trophy className="size-3.5 text-gold" /> Mon PR
          </CardLabel>
        </div>
        {pr ? (
          <Card highlighted className="flex items-baseline justify-between">
            <div>
              <p className="text-lg font-semibold text-gold">
                {pr.poidsKg}kg × {pr.reps}
              </p>
              <p className="mt-0.5 text-[10px] text-muted">
                {pr.date.toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <p className="text-xs text-muted-strong">
              1RM ~{Math.round(pr.oneRmKg)}kg
            </p>
          </Card>
        ) : (
          <Card className="flex items-center gap-3 py-4">
            <Trophy className="size-6 text-muted" />
            <p className="flex-1 text-xs text-muted-strong">
              Pas encore de PR sur cet exo. Première séance et c&apos;est plié.
            </p>
          </Card>
        )}
      </section>

      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <CardLabel className="flex items-center gap-1">
            <TrendingUp className="size-3.5 text-accent-soft" /> Historique
          </CardLabel>
        </div>
        {historique.length === 0 ? (
          <Card className="py-4 text-center text-xs text-muted-strong">
            Pas encore de séance loggée avec cet exo.
          </Card>
        ) : (
          <Card className="flex flex-col gap-1">
            {historique.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-bg px-2.5 py-2 text-xs"
              >
                <span>{h.date.toLocaleDateString("fr-FR")}</span>
                <span>
                  {h.poidsKg}kg × {h.reps}
                </span>
                <span className="text-muted">1RM ~{Math.round(h.estimated1RM)}</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

async function safeGetExercice(id: string) {
  try {
    return await prisma.exercice.findUnique({
      where: { id },
      select: {
        id: true,
        nom: true,
        muscles: true,
        materiel: true,
        prise: true,
        dynamisme: true,
        tempo: true,
        guideExecution: true,
        isLeste: true,
        createdById: true,
      },
    });
  } catch {
    return null;
  }
}

async function safeGetBestPR(userId: string | undefined, exerciceId: string) {
  if (!userId) return null;
  try {
    return await prisma.pR.findFirst({
      where: { userId, exerciceId },
      orderBy: { oneRmKg: "desc" },
      select: { poidsKg: true, reps: true, oneRmKg: true, date: true },
    });
  } catch {
    return null;
  }
}

