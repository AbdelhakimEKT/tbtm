import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExerciceForm } from "../../_form";
import { DeleteExerciceButton } from "./_delete-button";

type Params = Promise<{ id: string }>;

export default async function EditExercicePage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/exercices/${id}/modifier`);
  }

  const exo = await prisma.exercice.findUnique({
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

  if (!exo) notFound();
  const isOwner = exo.createdById === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    redirect(`/exercices/${id}`);
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href={`/exercices/${id}`}
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <DeleteExerciceButton id={id} />
      </header>

      <h1 className="text-2xl font-semibold">Modifier</h1>
      <p className="mt-1 text-xs text-muted-strong">{exo.nom}</p>

      <div className="mt-6">
        <ExerciceForm
          mode="edit"
          initial={{
            id: exo.id,
            nom: exo.nom,
            muscles: exo.muscles,
            materiel: exo.materiel,
            prise: exo.prise,
            dynamisme: exo.dynamisme,
            tempo: exo.tempo,
            isLeste: exo.isLeste,
            guideExecution: exo.guideExecution,
          }}
        />
      </div>
    </div>
  );
}
