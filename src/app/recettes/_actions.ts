"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectAndAwardBadges } from "@/lib/badges";

const CATEGORIE_VALUES = [
  "PETIT_DEJEUNER",
  "PLAT",
  "COLLATION",
  "DESSERT",
  "BOISSON",
  "SAUCE",
] as const;

const VISIBILITE_VALUES = ["PRIVE", "AMIS", "COMMUNAUTE"] as const;

const recetteSchema = z.object({
  nom: z.string().trim().min(2).max(80),
  description: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  portions: z.coerce.number().int().min(1).max(50).default(1),
  tempsPrepMin: z.coerce
    .number()
    .int()
    .min(1)
    .max(1440)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  categorie: z.enum(CATEGORIE_VALUES),
  visibilite: z.enum(VISIBILITE_VALUES).default("PRIVE"),
  photo: z
    .string()
    .url()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  macrosManuelles: z.boolean().default(false),
  caloriesPortion: z.coerce.number().min(0).max(5000).nullable().optional()
    .or(z.literal("").transform(() => null)),
  proteinesPortion: z.coerce.number().min(0).max(500).nullable().optional()
    .or(z.literal("").transform(() => null)),
  glucidesPortion: z.coerce.number().min(0).max(500).nullable().optional()
    .or(z.literal("").transform(() => null)),
  lipidesPortion: z.coerce.number().min(0).max(500).nullable().optional()
    .or(z.literal("").transform(() => null)),
});

function readRecetteForm(formData: FormData) {
  return {
    nom: formData.get("nom"),
    description: formData.get("description") || null,
    portions: formData.get("portions") || 1,
    tempsPrepMin: formData.get("tempsPrepMin") || null,
    categorie: formData.get("categorie"),
    visibilite: formData.get("visibilite") || "PRIVE",
    photo: formData.get("photo") || null,
    macrosManuelles: formData.get("macrosManuelles") === "on",
    caloriesPortion: formData.get("caloriesPortion") || null,
    proteinesPortion: formData.get("proteinesPortion") || null,
    glucidesPortion: formData.get("glucidesPortion") || null,
    lipidesPortion: formData.get("lipidesPortion") || null,
  };
}

type ActionResult<T = { id: string }> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export async function createRecette(
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const parsed = recetteSchema.safeParse(readRecetteForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }

  const created = await prisma.recette.create({
    data: {
      ...parsed.data,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  await detectAndAwardBadges({ userId: session.user.id });

  revalidatePath("/recettes");
  return { ok: true, id: created.id };
}

export async function updateRecette(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const recette = await prisma.recette.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!recette) return { ok: false, error: "Recette introuvable" };
  if (
    recette.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return { ok: false, error: "Pas tes droits" };
  }

  const parsed = recetteSchema.safeParse(readRecetteForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }

  await prisma.recette.update({ where: { id }, data: parsed.data });
  revalidatePath("/recettes");
  revalidatePath(`/recettes/${id}`);
  return { ok: true, id };
}

export async function deleteRecette(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const recette = await prisma.recette.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!recette) return { ok: false, error: "Recette introuvable" };
  if (
    recette.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return { ok: false, error: "Pas tes droits" };
  }

  await prisma.recette.delete({ where: { id } });
  revalidatePath("/recettes");
  redirect("/recettes");
}

// Ajout / suppression d'un ingrédient dans une recette
const recetteIngredientSchema = z.object({
  ingredientId: z.string().min(1),
  grammes: z.coerce.number().min(0.1).max(5000),
});

export async function addIngredientToRecette(
  recetteId: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const recette = await prisma.recette.findUnique({
    where: { id: recetteId },
    select: { createdById: true, _count: { select: { ingredients: true } } },
  });
  if (!recette) return { ok: false, error: "Recette introuvable" };
  if (
    recette.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return { ok: false, error: "Pas tes droits" };
  }

  const parsed = recetteIngredientSchema.safeParse({
    ingredientId: formData.get("ingredientId"),
    grammes: formData.get("grammes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }

  const created = await prisma.recetteIngredient.create({
    data: {
      recetteId,
      ingredientId: parsed.data.ingredientId,
      grammes: parsed.data.grammes,
      ordre: recette._count.ingredients,
    },
    select: { id: true },
  });

  revalidatePath(`/recettes/${recetteId}`);
  return { ok: true, id: created.id };
}

export async function updateRecetteIngredient(
  recetteIngredientId: string,
  grammes: number,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  if (!Number.isFinite(grammes) || grammes <= 0 || grammes > 5000) {
    return { ok: false, error: "Grammage invalide" };
  }

  const row = await prisma.recetteIngredient.findUnique({
    where: { id: recetteIngredientId },
    select: { recetteId: true, recette: { select: { createdById: true } } },
  });
  if (!row) return { ok: false, error: "Introuvable" };
  if (
    row.recette.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return { ok: false, error: "Pas tes droits" };
  }

  await prisma.recetteIngredient.update({
    where: { id: recetteIngredientId },
    data: { grammes },
  });

  revalidatePath(`/recettes/${row.recetteId}`);
  return { ok: true, id: recetteIngredientId };
}

export async function removeIngredientFromRecette(
  recetteIngredientId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const row = await prisma.recetteIngredient.findUnique({
    where: { id: recetteIngredientId },
    select: { recetteId: true, recette: { select: { createdById: true } } },
  });
  if (!row) return { ok: false, error: "Introuvable" };
  if (
    row.recette.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return { ok: false, error: "Pas tes droits" };
  }

  await prisma.recetteIngredient.delete({ where: { id: recetteIngredientId } });
  revalidatePath(`/recettes/${row.recetteId}`);
  return { ok: true, id: recetteIngredientId };
}
