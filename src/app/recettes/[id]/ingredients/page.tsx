import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { IngredientsManager } from "./_client";

type Params = Promise<{ id: string }>;

export default async function RecetteIngredientsPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/recettes/${id}/ingredients`);
  }

  const recette = await prisma.recette.findUnique({
    where: { id },
    select: {
      id: true,
      nom: true,
      portions: true,
      createdById: true,
      ingredients: {
        orderBy: { ordre: "asc" },
        select: {
          id: true,
          grammes: true,
          ingredient: {
            select: {
              id: true,
              nom: true,
              photo: true,
              caloriesP100: true,
              proteinesP100: true,
              glucidesP100: true,
              lipidesP100: true,
            },
          },
        },
      },
    },
  });
  if (!recette) notFound();
  if (
    recette.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    redirect(`/recettes/${id}`);
  }

  // Ingrédients récents pour le picker (déjà loggés/créés)
  const recents = await prisma.ingredient.findMany({
    where: {
      OR: [
        { createdById: session.user.id },
        { nutritionLogs: { some: { userId: session.user.id } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      nom: true,
      photo: true,
      caloriesP100: true,
      proteinesP100: true,
      glucidesP100: true,
      lipidesP100: true,
    },
  });

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
      </header>

      <h1 className="text-2xl font-semibold">Ingrédients</h1>
      <p className="mt-1 text-xs text-muted-strong">
        {recette.nom} · {recette.portions} portion
        {recette.portions > 1 ? "s" : ""}
      </p>

      <div className="mt-5">
        <IngredientsManager
          recetteId={recette.id}
          portions={recette.portions}
          initialIngredients={recette.ingredients}
          recents={recents}
        />
      </div>
    </div>
  );
}
