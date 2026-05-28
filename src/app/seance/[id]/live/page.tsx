import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSuggestionForExercice, type Suggestion } from "@/lib/seance";

import { LiveSeance, type LiveExerciceData } from "./_live-seance";

type Params = Promise<{ id: string }>;

export default async function LiveSeancePage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/seance/${id}/live`);
  }

  const seance = await prisma.seance.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      userId: true,
      statut: true,
      noteDeFormeDuJour: true,
      programme: {
        select: {
          id: true,
          nom: true,
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
      },
      sets: {
        where: { validated: true },
        orderBy: [{ exerciceId: "asc" }, { ordre: "asc" }],
        select: {
          id: true,
          ordre: true,
          exerciceId: true,
          poidsKg: true,
          bwPlusKg: true,
          reps: true,
          rir: true,
          isBonus: true,
        },
      },
    },
  });

  if (!seance) notFound();
  if (seance.userId !== session.user.id) redirect("/");
  if (seance.statut !== "EN_COURS") redirect(`/seance/${id}`);
  if (!seance.programme || seance.programme.exercices.length === 0) {
    redirect("/programmes");
  }

  // Calcule la suggestion auto pour chaque exo (server-side)
  const exercicesWithSuggestion: LiveExerciceData[] = await Promise.all(
    seance.programme.exercices.map(async (pe) => {
      const suggestion: Suggestion = await getSuggestionForExercice({
        userId: session.user.id,
        exerciceId: pe.exercice.id,
        isLeste: pe.exercice.isLeste,
        plannedPoidsKg: pe.poidsCible,
        plannedBwPlusKg: pe.bwPlusKg,
        plannedReps: pe.repsCibles,
      });
      return {
        id: pe.id,
        ordre: pe.ordre,
        seriesCibles: pe.seriesCibles,
        repsCibles: pe.repsCibles,
        poidsCible: pe.poidsCible,
        bwPlusKg: pe.bwPlusKg,
        tempsRecupSec: pe.tempsRecupSec,
        notes: pe.notes,
        exercice: pe.exercice,
        suggestion,
        validatedSets: seance.sets
          .filter((s) => s.exerciceId === pe.exercice.id)
          .map((s) => ({
            id: s.id,
            ordre: s.ordre,
            poidsKg: s.poidsKg,
            bwPlusKg: s.bwPlusKg,
            reps: s.reps,
            rir: s.rir,
            isBonus: s.isBonus,
          })),
      };
    }),
  );

  return (
    <LiveSeance
      seanceId={seance.id}
      programmeNom={seance.programme.nom}
      startedAt={seance.date.toISOString()}
      noteDeFormeDuJour={seance.noteDeFormeDuJour}
      exercices={exercicesWithSuggestion}
    />
  );
}
