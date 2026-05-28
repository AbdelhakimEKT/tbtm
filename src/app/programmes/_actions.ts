"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ----------------------------------------------------------------------------
// Schémas
// ----------------------------------------------------------------------------

const MUSCLE_VALUES = [
  "PECTORAUX", "DOS", "EPAULES", "BICEPS", "TRICEPS", "AVANT_BRAS",
  "ABDOS", "LOMBAIRES", "QUADRICEPS", "ISCHIOS", "FESSIERS", "MOLLETS", "TRAPEZES",
] as const;

const VISIBILITE_VALUES = ["PRIVE", "AMIS", "COMMUNAUTE"] as const;

const programmeSchema = z.object({
  nom: z.string().min(2, "2 caractères minimum").max(60, "60 caractères max").trim(),
  description: z.string().max(500).trim().nullable().optional()
    .or(z.literal("").transform(() => null)),
  tags: z.array(z.enum(MUSCLE_VALUES)).default([]),
  visibilite: z.enum(VISIBILITE_VALUES).default("PRIVE"),
  frequenceHebdo: z.coerce.number().int().min(1).max(14).nullable().optional()
    .or(z.literal("").transform(() => null)),
});

type ProgrammeInput = z.infer<typeof programmeSchema>;
type ActionResult<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

function parseProgrammeForm(formData: FormData): ProgrammeInput | { error: string } {
  const raw = {
    nom: formData.get("nom"),
    description: formData.get("description") || null,
    tags: formData.getAll("tags"),
    visibilite: formData.get("visibilite") || "PRIVE",
    frequenceHebdo: formData.get("frequenceHebdo") || null,
  };
  const parsed = programmeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  return parsed.data;
}

type OwnerCheck = { ok: true } | { error: string };

async function requireProgrammeOwner(
  id: string,
  userId: string,
  role: string,
): Promise<OwnerCheck> {
  const prog = await prisma.programme.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!prog) return { error: "Programme introuvable" };
  if (prog.createdById !== userId && role !== "ADMIN") {
    return { error: "Pas tes droits là-dessus" };
  }
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Programme CRUD
// ----------------------------------------------------------------------------

export async function createProgramme(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const parsed = parseProgrammeForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const created = await prisma.programme.create({
    data: {
      ...parsed,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  revalidatePath("/programmes");
  return { ok: true, id: created.id };
}

export async function updateProgramme(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const check = await requireProgrammeOwner(id, session.user.id, session.user.role);
  if ("error" in check) return { ok: false, error: check.error };

  const parsed = parseProgrammeForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  await prisma.programme.update({
    where: { id },
    data: parsed,
  });

  revalidatePath("/programmes");
  revalidatePath(`/programmes/${id}`);
  return { ok: true, id };
}

export async function deleteProgramme(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const check = await requireProgrammeOwner(id, session.user.id, session.user.role);
  if ("error" in check) return { ok: false, error: check.error };

  await prisma.programme.delete({ where: { id } });

  revalidatePath("/programmes");
  redirect("/programmes");
}

export async function duplicateProgramme(sourceId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const source = await prisma.programme.findUnique({
    where: { id: sourceId },
    include: {
      exercices: { orderBy: { ordre: "asc" } },
    },
  });
  if (!source) return { ok: false, error: "Programme introuvable" };

  // Vérif accès : owner, admin, ou visibilité publique/amis (amis = TODO Phase 9)
  const canSee =
    source.createdById === session.user.id ||
    session.user.role === "ADMIN" ||
    source.visibilite === "COMMUNAUTE" ||
    source.visibilite === "AMIS";
  if (!canSee) return { ok: false, error: "Ce programme n'est pas accessible" };

  const copy = await prisma.programme.create({
    data: {
      nom: source.createdById === session.user.id ? `${source.nom} (copie)` : source.nom,
      description: source.description,
      tags: source.tags,
      visibilite: "PRIVE",
      frequenceHebdo: source.frequenceHebdo,
      createdById: session.user.id,
      exercices: {
        create: source.exercices.map((e) => ({
          ordre: e.ordre,
          seriesCibles: e.seriesCibles,
          repsCibles: e.repsCibles,
          poidsCible: e.poidsCible,
          bwPlusKg: e.bwPlusKg,
          tempsRecupSec: e.tempsRecupSec,
          notes: e.notes,
          exerciceId: e.exerciceId,
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/programmes");
  return { ok: true, id: copy.id };
}

/**
 * Bascule le statut "actif" d'un programme. NON exclusif : plusieurs programmes
 * peuvent être actifs en même temps (ex: split Upper/Lower, Push/Pull/Legs).
 */

// ----------------------------------------------------------------------------
// Templates : créent un set de programmes pré-remplis en 1 clic
// ----------------------------------------------------------------------------

type TemplateKey = "push-pull-legs" | "upper-lower" | "full-body";

const TEMPLATE_DEFS: Record<
  TemplateKey,
  { nom: string; programmes: { nom: string; exos: string[] }[] }
> = {
  "push-pull-legs": {
    nom: "Push / Pull / Legs",
    programmes: [
      {
        nom: "Push Day",
        exos: [
          "Développé couché",
          "Développé incliné haltères",
          "Développé militaire",
          "Dips lestés",
          "Élévations latérales",
          "Extensions triceps poulie",
        ],
      },
      {
        nom: "Pull Day",
        exos: [
          "Tractions",
          "Rowing barre",
          "Tirage poulie haute",
          "Curl biceps haltères",
          "Curl marteau",
        ],
      },
      {
        nom: "Legs Day",
        exos: [
          "Squat",
          "Soulevé de terre",
          "Hip thrust",
          "Leg curl",
          "Mollets debout",
        ],
      },
    ],
  },
  "upper-lower": {
    nom: "Upper / Lower",
    programmes: [
      {
        nom: "Upper",
        exos: [
          "Développé couché",
          "Tractions",
          "Développé militaire",
          "Rowing barre",
          "Curl marteau",
        ],
      },
      {
        nom: "Lower",
        exos: [
          "Squat",
          "Soulevé de terre",
          "Hip thrust",
          "Mollets debout",
        ],
      },
    ],
  },
  "full-body": {
    nom: "Full body 3×/sem",
    programmes: [
      {
        nom: "Full Body",
        exos: [
          "Squat",
          "Développé couché",
          "Rowing barre",
          "Développé militaire",
          "Curl biceps haltères",
          "Planche",
        ],
      },
    ],
  },
};

export async function createProgrammesFromTemplate(
  formData: FormData,
): Promise<ActionResult<{ ids: string[] }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const templateKey = formData.get("template") as TemplateKey | null;
  if (!templateKey || !(templateKey in TEMPLATE_DEFS)) {
    return { ok: false, error: "Template inconnu" };
  }
  const template = TEMPLATE_DEFS[templateKey];

  const allExoNames = Array.from(
    new Set(template.programmes.flatMap((p) => p.exos)),
  );
  const exos = await prisma.exercice.findMany({
    where: {
      nom: { in: allExoNames },
      OR: [{ createdById: null }, { createdById: session.user.id }],
    },
    select: { id: true, nom: true },
  });
  const exoIdByName = new Map<string, string>();
  for (const e of exos) {
    if (!exoIdByName.has(e.nom)) exoIdByName.set(e.nom, e.id);
  }

  const ids: string[] = [];
  for (const prog of template.programmes) {
    const created = await prisma.programme.create({
      data: {
        nom: prog.nom,
        description: `Créé depuis le template ${template.nom}`,
        visibilite: "PRIVE",
        estProgrammeActif: true,
        createdById: session.user.id,
        exercices: {
          create: prog.exos
            .map((nom, idx) => {
              const exoId = exoIdByName.get(nom);
              if (!exoId) return null;
              return {
                ordre: idx,
                seriesCibles: 4,
                repsCibles: 8,
                tempsRecupSec: 90,
                exerciceId: exoId,
              };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null),
        },
      },
      select: { id: true },
    });
    ids.push(created.id);
  }

  revalidatePath("/");
  revalidatePath("/programmes");
  return { ok: true, ids };
}

export async function setActiveProgramme(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const prog = await prisma.programme.findUnique({
    where: { id },
    select: { createdById: true, estProgrammeActif: true },
  });
  if (!prog) return { ok: false, error: "Programme introuvable" };
  if (prog.createdById !== session.user.id) {
    return { ok: false, error: "Tu peux activer seulement tes propres programmes" };
  }

  await prisma.programme.update({
    where: { id },
    data: { estProgrammeActif: !prog.estProgrammeActif },
  });

  revalidatePath("/");
  revalidatePath("/programmes");
  revalidatePath(`/programmes/${id}`);
  return { ok: true, id };
}

// ----------------------------------------------------------------------------
// ProgrammeExercice : ajout / édition / suppression / réordonnancement
// ----------------------------------------------------------------------------

const programmeExerciceSchema = z.object({
  exerciceId: z.string().min(1),
  seriesCibles: z.coerce.number().int().min(1).max(20).default(3),
  repsCibles: z.coerce.number().int().min(1).max(100).default(8),
  poidsCible: z.coerce.number().min(0).max(1000).nullable().optional()
    .or(z.literal("").transform(() => null)),
  bwPlusKg: z.coerce.number().min(0).max(500).nullable().optional()
    .or(z.literal("").transform(() => null)),
  tempsRecupSec: z.coerce.number().int().min(0).max(900).default(90),
  notes: z.string().max(300).trim().nullable().optional()
    .or(z.literal("").transform(() => null)),
});

export async function addExerciceToProgramme(
  programmeId: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const check = await requireProgrammeOwner(programmeId, session.user.id, session.user.role);
  if ("error" in check) return { ok: false, error: check.error };

  const parsed = programmeExerciceSchema.safeParse({
    exerciceId: formData.get("exerciceId"),
    seriesCibles: formData.get("seriesCibles"),
    repsCibles: formData.get("repsCibles"),
    poidsCible: formData.get("poidsCible") || null,
    bwPlusKg: formData.get("bwPlusKg") || null,
    tempsRecupSec: formData.get("tempsRecupSec"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  // Cherche le prochain ordre
  const last = await prisma.programmeExercice.findFirst({
    where: { programmeId },
    orderBy: { ordre: "desc" },
    select: { ordre: true },
  });
  const nextOrdre = (last?.ordre ?? -1) + 1;

  const created = await prisma.programmeExercice.create({
    data: {
      ...parsed.data,
      programmeId,
      ordre: nextOrdre,
    },
    select: { id: true },
  });

  revalidatePath(`/programmes/${programmeId}`);
  return { ok: true, id: created.id };
}

export async function updateProgrammeExercice(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const row = await prisma.programmeExercice.findUnique({
    where: { id },
    select: { programmeId: true, programme: { select: { createdById: true } } },
  });
  if (!row) return { ok: false, error: "Ligne introuvable" };
  if (
    row.programme.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return { ok: false, error: "Pas tes droits là-dessus" };
  }

  const parsed = programmeExerciceSchema.partial().safeParse({
    exerciceId: formData.get("exerciceId") ?? undefined,
    seriesCibles: formData.get("seriesCibles") ?? undefined,
    repsCibles: formData.get("repsCibles") ?? undefined,
    poidsCible: formData.get("poidsCible") ?? undefined,
    bwPlusKg: formData.get("bwPlusKg") ?? undefined,
    tempsRecupSec: formData.get("tempsRecupSec") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  await prisma.programmeExercice.update({
    where: { id },
    data: parsed.data,
  });

  revalidatePath(`/programmes/${row.programmeId}`);
  return { ok: true, id };
}

export async function removeExerciceFromProgramme(
  id: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const row = await prisma.programmeExercice.findUnique({
    where: { id },
    select: { programmeId: true, ordre: true, programme: { select: { createdById: true } } },
  });
  if (!row) return { ok: false, error: "Ligne introuvable" };
  if (
    row.programme.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return { ok: false, error: "Pas tes droits là-dessus" };
  }

  // Supprime, puis re-compacte les ordres > ordre supprimé (pour ne pas laisser de trous)
  await prisma.$transaction(async (tx) => {
    await tx.programmeExercice.delete({ where: { id } });
    // Décrémente tous les ordres supérieurs en passant par un état négatif pour
    // ne pas violer le @@unique([programmeId, ordre])
    const after = await tx.programmeExercice.findMany({
      where: { programmeId: row.programmeId, ordre: { gt: row.ordre } },
      orderBy: { ordre: "asc" },
      select: { id: true },
    });
    for (let i = 0; i < after.length; i++) {
      await tx.programmeExercice.update({
        where: { id: after[i].id },
        data: { ordre: -(row.ordre + i + 1000) },
      });
    }
    for (let i = 0; i < after.length; i++) {
      await tx.programmeExercice.update({
        where: { id: after[i].id },
        data: { ordre: row.ordre + i },
      });
    }
  });

  revalidatePath(`/programmes/${row.programmeId}`);
  return { ok: true, id };
}

export async function reorderProgrammeExercices(
  programmeId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const check = await requireProgrammeOwner(programmeId, session.user.id, session.user.role);
  if ("error" in check) return { ok: false, error: check.error };

  // Vérif que tous les ids sont bien dans ce programme
  const existing = await prisma.programmeExercice.findMany({
    where: { programmeId },
    select: { id: true },
  });
  const existingSet = new Set(existing.map((r) => r.id));
  if (orderedIds.length !== existing.length || !orderedIds.every((id) => existingSet.has(id))) {
    return { ok: false, error: "Liste d'ordres invalide" };
  }

  // 2 passes : valeurs négatives -> valeurs finales (pour ne pas violer @@unique)
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.programmeExercice.update({
        where: { id: orderedIds[i] },
        data: { ordre: -(i + 1) - 1000 },
      });
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.programmeExercice.update({
        where: { id: orderedIds[i] },
        data: { ordre: i },
      });
    }
  });

  revalidatePath(`/programmes/${programmeId}`);
  return { ok: true, id: programmeId };
}
