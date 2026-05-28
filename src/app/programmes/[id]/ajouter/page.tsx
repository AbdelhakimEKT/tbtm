import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AddExerciceClient } from "./_client";

type Params = Promise<{ id: string }>;

export default async function AjouterExercicePage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/programmes/${id}/ajouter`);
  }

  const prog = await prisma.programme.findUnique({
    where: { id },
    select: { id: true, nom: true, createdById: true },
  });
  if (!prog) notFound();
  if (prog.createdById !== session.user.id && session.user.role !== "ADMIN") {
    redirect(`/programmes/${id}`);
  }

  const exercices = await prisma.exercice.findMany({
    orderBy: { nom: "asc" },
    select: {
      id: true,
      nom: true,
      muscles: true,
      materiel: true,
      isLeste: true,
    },
    take: 300,
  });

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href={`/programmes/${id}`}
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </header>

      <h1 className="text-2xl font-semibold">Ajouter un exercice</h1>
      <p className="mt-1 text-xs text-muted-strong">{prog.nom}</p>

      <div className="mt-5">
        <AddExerciceClient programmeId={id} exercices={exercices} />
      </div>
    </div>
  );
}
