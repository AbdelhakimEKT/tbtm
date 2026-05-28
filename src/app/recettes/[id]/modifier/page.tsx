import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { RecetteForm } from "../../_form";
import { DeleteRecetteButton } from "./_delete-button";

type Params = Promise<{ id: string }>;

export default async function EditRecettePage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/recettes/${id}/modifier`);
  }

  const recette = await prisma.recette.findUnique({
    where: { id },
    select: {
      id: true,
      nom: true,
      description: true,
      photo: true,
      portions: true,
      tempsPrepMin: true,
      categorie: true,
      visibilite: true,
      createdById: true,
      macrosManuelles: true,
      caloriesPortion: true,
      proteinesPortion: true,
      glucidesPortion: true,
      lipidesPortion: true,
    },
  });
  if (!recette) notFound();
  if (
    recette.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    redirect(`/recettes/${id}`);
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href={`/recettes/${id}`}
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <DeleteRecetteButton id={id} />
      </header>

      <h1 className="text-2xl font-semibold">Modifier</h1>
      <p className="mt-1 text-xs text-muted-strong">{recette.nom}</p>

      <div className="mt-6">
        <RecetteForm
          mode="edit"
          initial={{
            id: recette.id,
            nom: recette.nom,
            description: recette.description,
            portions: recette.portions,
            tempsPrepMin: recette.tempsPrepMin,
            categorie: recette.categorie,
            visibilite: recette.visibilite,
            photo: recette.photo,
            macrosManuelles: recette.macrosManuelles,
            caloriesPortion: recette.caloriesPortion,
            proteinesPortion: recette.proteinesPortion,
            glucidesPortion: recette.glucidesPortion,
            lipidesPortion: recette.lipidesPortion,
          }}
        />
      </div>
    </div>
  );
}
