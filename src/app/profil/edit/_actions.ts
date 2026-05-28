"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeCategorieForce } from "@/lib/categorie";

const profileSchema = z.object({
  pseudo: z
    .string()
    .min(3, "3 caractères minimum")
    .max(24, "24 caractères max")
    .regex(/^[a-zA-Z0-9_-]+$/, "Lettres, chiffres, _ et - uniquement"),
  poidsKg: z.coerce
    .number()
    .min(20, "Minimum 20 kg")
    .max(400, "Maximum 400 kg")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  tailleCm: z.coerce
    .number()
    .int()
    .min(100, "Minimum 100 cm")
    .max(250, "Maximum 250 cm")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  age: z.coerce
    .number()
    .int()
    .min(10, "Minimum 10 ans")
    .max(120, "Maximum 120 ans")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  sexe: z
    .enum(["HOMME", "FEMME", "AUTRE"])
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  niveauActivite: z.enum([
    "SEDENTAIRE",
    "LEGER",
    "MODERE",
    "ACTIF",
    "TRES_ACTIF",
  ]),
  objectif: z.enum([
    "PRISE_DE_MASSE",
    "SECHE",
    "FORCE",
    "FORME_GENERALE",
  ]),
  ville: z
    .string()
    .trim()
    .max(60)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

export async function updateProfile(
  formData: FormData,
): Promise<{ ok: true; categorieChanged: boolean } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const parsed = profileSchema.safeParse({
    pseudo: formData.get("pseudo"),
    poidsKg: formData.get("poidsKg") || null,
    tailleCm: formData.get("tailleCm") || null,
    age: formData.get("age") || null,
    sexe: formData.get("sexe") || null,
    niveauActivite: formData.get("niveauActivite") || "MODERE",
    objectif: formData.get("objectif"),
    ville: formData.get("ville") || null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }

  // Vérif unicité du pseudo s'il a changé
  const existing = await prisma.user.findUnique({
    where: { pseudo: parsed.data.pseudo },
    select: { id: true },
  });
  if (existing && existing.id !== session.user.id) {
    return { ok: false, error: "Ce pseudo est déjà pris" };
  }

  const before = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { categorie: true },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
  });

  // Recalcule la catégorie de force (le poids de corps a peut-être changé)
  const newCategorie = await computeCategorieForce(session.user.id);
  let categorieChanged = false;
  if (newCategorie !== before?.categorie) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { categorie: newCategorie },
    });
    categorieChanged = true;
  }

  revalidatePath("/profil");
  revalidatePath("/");
  return { ok: true, categorieChanged };
}

export async function updateProfileAndRedirect(formData: FormData) {
  const result = await updateProfile(formData);
  if (!result.ok) {
    // L'erreur sera ré-affichée via le client en cas d'échec ; ici on
    // n'arrive pas vu que la page client gère l'appel direct. Si appel direct
    // depuis form serveur, on redirige quand même.
    redirect("/profil/edit?error=" + encodeURIComponent(result.error));
  }
  redirect("/profil");
}
