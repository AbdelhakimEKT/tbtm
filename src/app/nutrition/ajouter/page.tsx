import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Repas } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REPAS_LABEL } from "@/lib/labels";
import { macrosFromGrammes } from "@/lib/nutrition";

import { AjouterClient } from "./_client";

const VALID_REPAS: Repas[] = [
  "PETIT_DEJEUNER",
  "DEJEUNER",
  "DINER",
  "COLLATION",
];

type SearchParams = Promise<{ repas?: string; date?: string }>;

export default async function AjouterAlimentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;
  if (!session?.user?.id) {
    redirect(
      `/auth/login?callbackUrl=/nutrition/ajouter?repas=${params.repas ?? "DEJEUNER"}`,
    );
  }

  const repas: Repas = VALID_REPAS.find((r) => r === params.repas) ?? "DEJEUNER";
  const date = params.date ?? todayLocalIso();

  // Mes ingrédients récents (créés ou loggés)
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

  // Mes favoris (juste les IDs, on récupère les détails plus bas)
  const favorisRaw = await prisma.nutritionFavori.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
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
      recetteId: true,
    },
  });
  const favoriIngredients = favorisRaw
    .map((f) => f.ingredient)
    .filter((i): i is NonNullable<typeof i> => i !== null);
  const favoriIngredientIds = favoriIngredients.map((i) => i.id);
  const favoriRecetteIds = favorisRaw
    .map((f) => f.recetteId)
    .filter((id): id is string => id !== null);

  // Mes recettes (avec ingrédients pour calculer les macros par portion)
  const recettesRaw = await prisma.recette.findMany({
    where: {
      AND: [
        {
          OR: [
            { createdById: session.user.id },
            { visibilite: "COMMUNAUTE" },
          ],
        },
        // Soit a au moins 1 ingrédient, soit a des macros manuelles renseignées
        {
          OR: [
            { ingredients: { some: {} } },
            { macrosManuelles: true },
          ],
        },
      ],
    },
    orderBy: [
      // Mes recettes d'abord, puis les autres
      { updatedAt: "desc" },
    ],
    take: 30,
    select: {
      id: true,
      nom: true,
      photo: true,
      portions: true,
      categorie: true,
      createdById: true,
      createdBy: { select: { pseudo: true } },
      macrosManuelles: true,
      caloriesPortion: true,
      proteinesPortion: true,
      glucidesPortion: true,
      lipidesPortion: true,
      ingredients: {
        select: {
          grammes: true,
          ingredient: {
            select: {
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

  // Précompute macros par portion côté serveur pour pas re-calculer en client
  const recettes = recettesRaw.map((r) => {
    const portions = r.portions > 0 ? r.portions : 1;

    // Macros manuelles : on les prend telles quelles
    if (r.macrosManuelles) {
      return {
        id: r.id,
        nom: r.nom,
        photo: r.photo,
        portions: r.portions,
        categorie: r.categorie,
        auteurPseudo: r.createdBy.pseudo,
        isMine: r.createdById === session.user.id,
        macrosParPortion: {
          calories: Math.round(r.caloriesPortion ?? 0),
          proteines: Math.round(r.proteinesPortion ?? 0),
          glucides: Math.round(r.glucidesPortion ?? 0),
          lipides: Math.round(r.lipidesPortion ?? 0),
        },
      };
    }

    // Sinon calcul depuis ingrédients
    const total = r.ingredients.reduce(
      (acc, ri) => {
        const m = macrosFromGrammes({
          grammes: ri.grammes,
          ...ri.ingredient,
        });
        acc.calories += m.calories;
        acc.proteines += m.proteines;
        acc.glucides += m.glucides;
        acc.lipides += m.lipides;
        return acc;
      },
      { calories: 0, proteines: 0, glucides: 0, lipides: 0 },
    );
    return {
      id: r.id,
      nom: r.nom,
      photo: r.photo,
      portions: r.portions,
      categorie: r.categorie,
      auteurPseudo: r.createdBy.pseudo,
      isMine: r.createdById === session.user.id,
      macrosParPortion: {
        calories: Math.round(total.calories / portions),
        proteines: Math.round(total.proteines / portions),
        glucides: Math.round(total.glucides / portions),
        lipides: Math.round(total.lipides / portions),
      },
    };
  })
  // Mes recettes d'abord
  .sort((a, b) => Number(b.isMine) - Number(a.isMine));

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href={`/nutrition?date=${date}`}
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span className="rounded-full bg-accent-bg px-3 py-1 text-[11px] font-medium text-accent-soft">
          {REPAS_LABEL[repas]}
        </span>
      </header>

      <h1 className="text-2xl font-semibold">Ajouter</h1>
      <p className="mt-1 text-xs text-muted-strong">
        Scanne, cherche, ou pioche dans tes recettes.
      </p>

      <div className="mt-5">
        <AjouterClient
          repas={repas}
          date={date}
          recents={recents}
          recettes={recettes}
          favoriIngredients={favoriIngredients}
          favoriIngredientIds={favoriIngredientIds}
          favoriRecetteIds={favoriRecetteIds}
        />
      </div>
    </div>
  );
}

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
