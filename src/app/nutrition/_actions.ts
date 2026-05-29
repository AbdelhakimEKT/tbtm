"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  macrosFromGrammes,
  PORTION_GRAMMES,
  quantiteToGrammes,
} from "@/lib/nutrition";
import {
  lookupOpenFoodFactsBarcode,
  searchOpenFoodFacts,
  type OFFProduct,
} from "@/lib/openfoodfacts";

// ----------------------------------------------------------------------------
// Helpers OpenFoodFacts (server-side proxy)
// ----------------------------------------------------------------------------

export async function searchFood(query: string): Promise<OFFProduct[]> {
  return searchOpenFoodFacts(query, 15);
}

export async function lookupBarcode(
  barcode: string,
): Promise<OFFProduct | null> {
  return lookupOpenFoodFactsBarcode(barcode);
}

// ----------------------------------------------------------------------------
// Ingrédients
// ----------------------------------------------------------------------------

const REPAS_VALUES = [
  "PETIT_DEJEUNER",
  "DEJEUNER",
  "DINER",
  "COLLATION",
] as const;

const PORTION_VALUES = [
  "CUILLERE_CAFE",
  "CUILLERE_SOUPE",
  "POIGNEE",
  "BOL",
  "ASSIETTE",
  "GRAMMES",
  "UNITE",
] as const;

const ingredientCreateSchema = z.object({
  nom: z.string().trim().min(2).max(80),
  caloriesP100: z.coerce.number().min(0).max(2000),
  proteinesP100: z.coerce.number().min(0).max(200),
  glucidesP100: z.coerce.number().min(0).max(200),
  lipidesP100: z.coerce.number().min(0).max(200),
  openFoodFactsId: z.string().nullable().optional(),
  photo: z.string().url().nullable().optional()
    .or(z.literal("").transform(() => null)),
});

type IngredientResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Crée un ingrédient (user OU openfoodfacts). Pour les OFF, idempotent via
 * `openFoodFactsId` unique.
 */
export async function createIngredient(
  formData: FormData,
): Promise<IngredientResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const parsed = ingredientCreateSchema.safeParse({
    nom: formData.get("nom"),
    caloriesP100: formData.get("caloriesP100"),
    proteinesP100: formData.get("proteinesP100"),
    glucidesP100: formData.get("glucidesP100"),
    lipidesP100: formData.get("lipidesP100"),
    openFoodFactsId: formData.get("openFoodFactsId") ?? null,
    photo: formData.get("photo") ?? null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }

  if (parsed.data.openFoodFactsId) {
    const existing = await prisma.ingredient.findUnique({
      where: { openFoodFactsId: parsed.data.openFoodFactsId },
      select: { id: true },
    });
    if (existing) return { ok: true, id: existing.id };
  }

  const created = await prisma.ingredient.create({
    data: {
      ...parsed.data,
      openFoodFactsId: parsed.data.openFoodFactsId ?? null,
      photo: parsed.data.photo ?? null,
      createdById: parsed.data.openFoodFactsId ? null : session.user.id,
    },
    select: { id: true },
  });

  return { ok: true, id: created.id };
}

// ----------------------------------------------------------------------------
// Nutrition log
// ----------------------------------------------------------------------------

const logCreateSchema = z
  .object({
    date: z.coerce.date(),
    repas: z.enum(REPAS_VALUES),
    portionType: z.enum(PORTION_VALUES),
    // Quantité = nombre de portions (1 cuillère, 2 bols, 100 grammes…).
    // Le cap dépend du type, donc on valide via `refine` sur le grammage total
    // au lieu d'un max arbitraire sur la quantité brute.
    quantite: z.coerce.number().min(0.1, "Doit être > 0").max(10000),
    ingredientId: z.string().nullable().optional(),
    recetteId: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      const g = quantiteToGrammes(data.portionType, data.quantite);
      return g > 0 && g <= 10000;
    },
    {
      message: "Quantité totale trop élevée (max 10 kg équivalent par entrée)",
      path: ["quantite"],
    },
  );

type LogResult = { ok: true; id: string } | { ok: false; error: string };

export async function createNutritionLog(
  input: z.input<typeof logCreateSchema>,
): Promise<LogResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const parsed = logCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }
  const data = parsed.data;

  if (!data.ingredientId && !data.recetteId) {
    return { ok: false, error: "Pas d'ingrédient ni de recette sélectionné" };
  }

  let calories = 0;
  let proteines = 0;
  let glucides = 0;
  let lipides = 0;
  const grammesEq = quantiteToGrammes(data.portionType, data.quantite);

  if (data.ingredientId) {
    const ing = await prisma.ingredient.findUnique({
      where: { id: data.ingredientId },
      select: {
        caloriesP100: true,
        proteinesP100: true,
        glucidesP100: true,
        lipidesP100: true,
      },
    });
    if (!ing) return { ok: false, error: "Ingrédient introuvable" };
    const m = macrosFromGrammes({ grammes: grammesEq, ...ing });
    calories = m.calories;
    proteines = m.proteines;
    glucides = m.glucides;
    lipides = m.lipides;
  } else if (data.recetteId) {
    const recette = await prisma.recette.findUnique({
      where: { id: data.recetteId },
      select: {
        portions: true,
        macrosManuelles: true,
        caloriesPortion: true,
        proteinesPortion: true,
        glucidesPortion: true,
        lipidesPortion: true,
        ingredients: {
          include: {
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
    if (!recette) return { ok: false, error: "Recette introuvable" };

    // Si macros manuelles renseignées → on les utilise directement par portion
    if (recette.macrosManuelles) {
      calories = (recette.caloriesPortion ?? 0) * data.quantite;
      proteines = (recette.proteinesPortion ?? 0) * data.quantite;
      glucides = (recette.glucidesPortion ?? 0) * data.quantite;
      lipides = (recette.lipidesPortion ?? 0) * data.quantite;
    } else {
      // Sinon on calcule depuis les ingrédients et on rapporte à la portion
      const total = recette.ingredients.reduce(
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
      calories = (total.calories / parPortion) * data.quantite;
      proteines = (total.proteines / parPortion) * data.quantite;
      glucides = (total.glucides / parPortion) * data.quantite;
      lipides = (total.lipides / parPortion) * data.quantite;
    }
  }

  const created = await prisma.nutritionLog.create({
    data: {
      userId: session.user.id,
      date: data.date,
      repas: data.repas,
      portionType: data.portionType,
      quantite: data.quantite,
      grammesEq,
      calories: Math.round(calories * 10) / 10,
      proteines: Math.round(proteines * 10) / 10,
      glucides: Math.round(glucides * 10) / 10,
      lipides: Math.round(lipides * 10) / 10,
      ingredientId: data.ingredientId ?? null,
      recetteId: data.recetteId ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/nutrition");
  return { ok: true, id: created.id };
}

export async function deleteNutritionLog(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const log = await prisma.nutritionLog.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!log) return { ok: false, error: "Log introuvable" };
  if (log.userId !== session.user.id) {
    return { ok: false, error: "Pas ton log" };
  }

  await prisma.nutritionLog.delete({ where: { id } });
  revalidatePath("/nutrition");
  return { ok: true };
}

// Pour les contextes où on a juste besoin de `PORTION_GRAMMES` côté client
export async function getPortionGrammes() {
  return PORTION_GRAMMES;
}

// ----------------------------------------------------------------------------
// Favoris (ingrédient OU recette, toggle simple)
// ----------------------------------------------------------------------------

export async function toggleFavoriIngredient(
  ingredientId: string,
): Promise<{ ok: true; favoris: boolean } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const existing = await prisma.nutritionFavori.findUnique({
    where: {
      userId_ingredientId: {
        userId: session.user.id,
        ingredientId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.nutritionFavori.delete({ where: { id: existing.id } });
    revalidatePath("/nutrition/ajouter");
    return { ok: true, favoris: false };
  }

  await prisma.nutritionFavori.create({
    data: {
      userId: session.user.id,
      ingredientId,
    },
  });
  revalidatePath("/nutrition/ajouter");
  return { ok: true, favoris: true };
}

export async function toggleFavoriRecette(
  recetteId: string,
): Promise<{ ok: true; favoris: boolean } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const existing = await prisma.nutritionFavori.findUnique({
    where: {
      userId_recetteId: {
        userId: session.user.id,
        recetteId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.nutritionFavori.delete({ where: { id: existing.id } });
    revalidatePath("/nutrition/ajouter");
    return { ok: true, favoris: false };
  }

  await prisma.nutritionFavori.create({
    data: {
      userId: session.user.id,
      recetteId,
    },
  });
  revalidatePath("/nutrition/ajouter");
  return { ok: true, favoris: true };
}
