import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, Globe, Lock, Pencil, Users } from "lucide-react";
import type { Visibilite } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardLabel } from "@/components/ui/card";
import {
  CATEGORIE_RECETTE_LABEL,
  VISIBILITE_LABEL,
} from "@/lib/labels";
import { macrosFromGrammes } from "@/lib/nutrition";

import { LogRecipeButton } from "./_log-button";

type Params = Promise<{ id: string }>;

const VISIBILITE_ICON: Record<Visibilite, React.ComponentType<{ className?: string }>> = {
  PRIVE: Lock,
  AMIS: Users,
  COMMUNAUTE: Globe,
};

export default async function RecetteDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();

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
      createdBy: { select: { pseudo: true } },
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

  const isOwner =
    !!session?.user?.id && recette.createdById === session.user.id;
  const canSee =
    isOwner ||
    session?.user?.role === "ADMIN" ||
    recette.visibilite !== "PRIVE";
  if (!canSee) redirect("/recettes");

  // Calcul macros totales
  const macrosTotales = recette.ingredients.reduce(
    (acc, ri) => {
      const m = macrosFromGrammes({
        grammes: ri.grammes,
        caloriesP100: ri.ingredient.caloriesP100,
        proteinesP100: ri.ingredient.proteinesP100,
        glucidesP100: ri.ingredient.glucidesP100,
        lipidesP100: ri.ingredient.lipidesP100,
      });
      acc.calories += m.calories;
      acc.proteines += m.proteines;
      acc.glucides += m.glucides;
      acc.lipides += m.lipides;
      return acc;
    },
    { calories: 0, proteines: 0, glucides: 0, lipides: 0 },
  );

  const parPortion = recette.portions > 0 ? recette.portions : 1;
  const macrosParPortion = {
    calories: macrosTotales.calories / parPortion,
    proteines: macrosTotales.proteines / parPortion,
    glucides: macrosTotales.glucides / parPortion,
    lipides: macrosTotales.lipides / parPortion,
  };

  const VisibIcon = VISIBILITE_ICON[recette.visibilite];

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/recettes"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
        {isOwner && (
          <Link
            href={`/recettes/${recette.id}/modifier`}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-card-border bg-card px-3 text-xs text-muted-strong hover:text-fg"
          >
            <Pencil className="size-3.5" /> Modifier
          </Link>
        )}
      </header>

      {recette.photo && (
        <img
          src={recette.photo}
          alt={recette.nom}
          className="mb-4 h-48 w-full rounded-xl object-cover"
        />
      )}

      <h1 className="text-2xl font-semibold">{recette.nom}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-strong">
        <span className="rounded-full bg-accent-bg px-2 py-0.5 text-accent-soft">
          {CATEGORIE_RECETTE_LABEL[recette.categorie]}
        </span>
        <span>par {recette.createdBy.pseudo}</span>
        <VisibIcon className="size-3" />
        <span>{VISIBILITE_LABEL[recette.visibilite]}</span>
      </div>

      {recette.description && (
        <p className="mt-3 text-sm text-muted-strong">{recette.description}</p>
      )}

      <section className="mt-4 grid grid-cols-3 gap-2">
        <Card className="flex flex-col items-center gap-0.5 py-3 text-center">
          <CardLabel>Portions</CardLabel>
          <p className="text-lg font-medium">{recette.portions}</p>
        </Card>
        <Card className="flex flex-col items-center gap-0.5 py-3 text-center">
          <CardLabel className="inline-flex items-center gap-0.5">
            <Clock className="size-3" /> Prep
          </CardLabel>
          <p className="text-lg font-medium">
            {recette.tempsPrepMin ? `${recette.tempsPrepMin}min` : "—"}
          </p>
        </Card>
        <Card className="flex flex-col items-center gap-0.5 py-3 text-center">
          <CardLabel>Kcal / portion</CardLabel>
          <p className="text-lg font-medium">
            {Math.round(macrosParPortion.calories)}
          </p>
        </Card>
      </section>

      <section className="mt-4">
        <CardLabel className="mb-2 px-1">Macros par portion</CardLabel>
        <Card className="grid grid-cols-3 gap-2 text-center text-[11px]">
          <div>
            <p className="text-sm font-semibold text-accent-soft">
              {Math.round(macrosParPortion.proteines)}g
            </p>
            <p className="text-[9px] text-muted">protéines</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-accent-soft">
              {Math.round(macrosParPortion.glucides)}g
            </p>
            <p className="text-[9px] text-muted">glucides</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-warning">
              {Math.round(macrosParPortion.lipides)}g
            </p>
            <p className="text-[9px] text-muted">lipides</p>
          </div>
        </Card>
      </section>

      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <CardLabel>Ingrédients</CardLabel>
          {isOwner && (
            <Link
              href={`/recettes/${recette.id}/ingredients`}
              className="text-[11px] text-accent-soft hover:underline"
            >
              + Gérer
            </Link>
          )}
        </div>
        {recette.ingredients.length === 0 ? (
          <Card className="py-4 text-center text-[11px] text-muted-strong">
            Aucun ingrédient ajouté pour l&apos;instant.
            {isOwner && (
              <>
                {" "}
                <Link
                  href={`/recettes/${recette.id}/ingredients`}
                  className="text-accent-soft underline-offset-2 hover:underline"
                >
                  En ajouter
                </Link>
                .
              </>
            )}
          </Card>
        ) : (
          <Card className="flex flex-col gap-1.5">
            {recette.ingredients.map((ri) => (
              <div
                key={ri.id}
                className="flex items-center gap-2 rounded-md bg-bg px-2.5 py-1.5"
              >
                {ri.ingredient.photo ? (
                  <img
                    src={ri.ingredient.photo}
                    alt=""
                    className="size-7 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="grid size-7 shrink-0 place-items-center rounded bg-accent-bg text-[10px] font-medium text-accent-soft">
                    {ri.ingredient.nom.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="min-w-0 flex-1 truncate text-xs">
                  {ri.ingredient.nom}
                </p>
                <p className="shrink-0 text-[11px] text-muted-strong">
                  {Math.round(ri.grammes)}g
                </p>
              </div>
            ))}
          </Card>
        )}
      </section>

      {recette.ingredients.length > 0 && session?.user?.id && (
        <div className="mt-6">
          <LogRecipeButton
            recetteId={recette.id}
            recetteNom={recette.nom}
          />
        </div>
      )}
    </div>
  );
}
