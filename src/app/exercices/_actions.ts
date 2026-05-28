"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MUSCLE_VALUES = [
  "PECTORAUX", "DOS", "EPAULES", "BICEPS", "TRICEPS", "AVANT_BRAS",
  "ABDOS", "LOMBAIRES", "QUADRICEPS", "ISCHIOS", "FESSIERS", "MOLLETS", "TRAPEZES",
] as const;

const MATERIEL_VALUES = [
  "POIDS_DE_CORPS", "HALTERES", "BARRE", "BARRE_TRACTION", "BARRE_DIPS",
  "ELASTIQUE", "LEST", "POULIE", "MACHINE", "KETTLEBELL",
] as const;

const PRISE_VALUES = [
  "PRONATION", "SUPINATION", "NEUTRE", "PRISE_LARGE", "PRISE_SERREE", "PRISE_MIXTE",
] as const;

const DYNAMISME_VALUES = ["EXPLOSIF", "CONTROLE", "ISOMETRIQUE"] as const;

const exerciceSchema = z.object({
  nom: z.string().min(2, "2 caractères minimum").max(60, "60 caractères max").trim(),
  muscles: z.array(z.enum(MUSCLE_VALUES)).min(1, "Au moins un muscle"),
  materiel: z.array(z.enum(MATERIEL_VALUES)).min(1, "Au moins un matériel"),
  prise: z.enum(PRISE_VALUES).nullable().optional(),
  dynamisme: z.enum(DYNAMISME_VALUES).default("CONTROLE"),
  tempo: z
    .string()
    .trim()
    .regex(/^\d-\d-\d-\d$/, "Format X-X-X-X (ex: 3-1-1-0)")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  isLeste: z.boolean().default(false),
  guideExecution: z.string().max(4000).trim().nullable().optional()
    .or(z.literal("").transform(() => null)),
});

export type ExerciceInput = z.infer<typeof exerciceSchema>;

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

function parseForm(formData: FormData): ExerciceInput | { error: string } {
  const raw = {
    nom: formData.get("nom"),
    muscles: formData.getAll("muscles"),
    materiel: formData.getAll("materiel"),
    prise: formData.get("prise") || null,
    dynamisme: formData.get("dynamisme") || "CONTROLE",
    tempo: formData.get("tempo") || null,
    isLeste: formData.get("isLeste") === "on",
    guideExecution: formData.get("guideExecution") || null,
  };

  const parsed = exerciceSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Données invalides" };
  }
  return parsed.data;
}

export async function createExercice(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const parsed = parseForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const created = await prisma.exercice.create({
    data: {
      ...parsed,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  revalidatePath("/exercices");
  return { ok: true, id: created.id };
}

export async function updateExercice(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const exo = await prisma.exercice.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!exo) return { ok: false, error: "Exercice introuvable" };
  const isOwner = exo.createdById === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return { ok: false, error: "Tu peux modifier seulement tes propres exercices" };
  }

  const parsed = parseForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  await prisma.exercice.update({
    where: { id },
    data: parsed,
  });

  revalidatePath("/exercices");
  revalidatePath(`/exercices/${id}`);
  return { ok: true, id };
}

export async function deleteExercice(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const exo = await prisma.exercice.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!exo) return { ok: false, error: "Exercice introuvable" };
  const isOwner = exo.createdById === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return { ok: false, error: "Tu peux supprimer seulement tes propres exercices" };
  }

  // On bloque la suppression si l'exo est utilisé (FK Restrict) — propre.
  try {
    await prisma.exercice.delete({ where: { id } });
  } catch {
    return {
      ok: false,
      error: "Impossible : cet exo est utilisé dans un programme ou une séance.",
    };
  }

  revalidatePath("/exercices");
  redirect("/exercices");
}
