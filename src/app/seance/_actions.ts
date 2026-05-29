"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeNextStreak,
  detectAndCreatePRs,
  levelFromXp,
} from "@/lib/seance";
import { detectAndAwardBadges } from "@/lib/badges";
import { computeCategorieForce } from "@/lib/categorie";
import { logAudit } from "@/lib/admin";

// ----------------------------------------------------------------------------
// Démarrage : crée ou reprend une séance en cours pour ce programme
// ----------------------------------------------------------------------------

export async function createSeanceFromProgramme(formData: FormData) {
  const session = await auth();

  const programmeId = formData.get("programmeId");
  if (typeof programmeId !== "string" || !programmeId) {
    redirect("/programmes");
  }

  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/programmes/${programmeId}`);
  }

  const prog = await prisma.programme.findUnique({
    where: { id: programmeId },
    select: {
      id: true,
      createdById: true,
      visibilite: true,
      exercices: { select: { id: true }, take: 1 },
    },
  });
  if (!prog) {
    redirect("/programmes");
  }

  // Vérif accès
  const canSee =
    prog.createdById === session.user.id ||
    session.user.role === "ADMIN" ||
    prog.visibilite === "COMMUNAUTE" ||
    prog.visibilite === "AMIS";
  if (!canSee || prog.exercices.length === 0) {
    redirect(`/programmes/${programmeId}`);
  }

  // Y a-t-il déjà une séance EN_COURS pour ce programme ? On la reprend.
  const enCours = await prisma.seance.findFirst({
    where: {
      userId: session.user.id,
      programmeId,
      statut: "EN_COURS",
    },
    select: { id: true },
  });
  if (enCours) {
    redirect(`/seance/${enCours.id}/live`);
  }

  const created = await prisma.seance.create({
    data: {
      userId: session.user.id,
      programmeId,
      statut: "EN_COURS",
    },
    select: { id: true },
  });

  revalidatePath("/");
  redirect(`/seance/${created.id}/live`);
}

// ----------------------------------------------------------------------------
// Validation d'une série
// ----------------------------------------------------------------------------

const validateSetSchema = z.object({
  exerciceId: z.string().min(1),
  ordre: z.coerce.number().int().min(1).max(50),
  poidsKg: z.coerce.number().min(0).max(1000),
  bwPlusKg: z.coerce.number().min(0).max(500).nullable().optional(),
  reps: z.coerce.number().int().min(0).max(200),
  rir: z.coerce.number().int().min(0).max(20).nullable().optional(),
  restSec: z.coerce.number().int().min(0).max(3600).nullable().optional(),
  isBonus: z.boolean().default(false),
});

type SeanceActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type SeanceCheck = { ok: true } | { error: string };

async function requireSeanceEnCours(
  seanceId: string,
  userId: string,
): Promise<SeanceCheck> {
  const seance = await prisma.seance.findUnique({
    where: { id: seanceId },
    select: { id: true, userId: true, statut: true },
  });
  if (!seance) return { error: "Séance introuvable" };
  if (seance.userId !== userId) return { error: "Pas ta séance" };
  if (seance.statut !== "EN_COURS") {
    return { error: "Séance déjà clôturée" };
  }
  return { ok: true };
}

export async function validateSet(
  seanceId: string,
  input: z.input<typeof validateSetSchema>,
): Promise<SeanceActionResult<{ setId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const check = await requireSeanceEnCours(seanceId, session.user.id);
  if ("error" in check) return { ok: false, error: check.error };

  const parsed = validateSetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }
  const data = parsed.data;

  // Idempotent : si une série de même ordre existe déjà pour cet exo dans
  // cette séance, on la met à jour au lieu de doubler.
  const existing = await prisma.seanceSet.findFirst({
    where: {
      seanceId,
      exerciceId: data.exerciceId,
      ordre: data.ordre,
      isBonus: data.isBonus,
    },
    select: { id: true },
  });

  const saved = existing
    ? await prisma.seanceSet.update({
        where: { id: existing.id },
        data: {
          poidsKg: data.poidsKg,
          bwPlusKg: data.bwPlusKg ?? null,
          reps: data.reps,
          rir: data.rir ?? null,
          restSec: data.restSec ?? null,
          validated: true,
        },
        select: { id: true },
      })
    : await prisma.seanceSet.create({
        data: {
          seanceId,
          exerciceId: data.exerciceId,
          ordre: data.ordre,
          poidsKg: data.poidsKg,
          bwPlusKg: data.bwPlusKg ?? null,
          reps: data.reps,
          rir: data.rir ?? null,
          restSec: data.restSec ?? null,
          isBonus: data.isBonus,
          validated: true,
        },
        select: { id: true },
      });

  revalidatePath(`/seance/${seanceId}/live`);
  return { ok: true, setId: saved.id };
}

export async function unvalidateSet(
  seanceId: string,
  setId: string,
): Promise<SeanceActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const check = await requireSeanceEnCours(seanceId, session.user.id);
  if ("error" in check) return { ok: false, error: check.error };

  // On supprime carrément la ligne (les non validés sont inférés depuis le plan)
  await prisma.seanceSet.delete({ where: { id: setId } });

  revalidatePath(`/seance/${seanceId}/live`);
  return { ok: true };
}

const SET_NOTE_MAX = 200;

export async function updateSetNote(
  seanceId: string,
  setId: string,
  rawNote: string | null,
): Promise<SeanceActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const check = await requireSeanceEnCours(seanceId, session.user.id);
  if ("error" in check) return { ok: false, error: check.error };

  // Trim + cap length
  const trimmed = (rawNote ?? "").trim();
  if (trimmed.length > SET_NOTE_MAX) {
    return { ok: false, error: `Note trop longue (max ${SET_NOTE_MAX} caractères)` };
  }
  const value = trimmed.length === 0 ? null : trimmed;

  // Vérifie que le set appartient bien à cette séance
  const set = await prisma.seanceSet.findUnique({
    where: { id: setId },
    select: { seanceId: true },
  });
  if (!set || set.seanceId !== seanceId) {
    return { ok: false, error: "Set introuvable" };
  }

  await prisma.seanceSet.update({
    where: { id: setId },
    data: { notes: value },
  });

  revalidatePath(`/seance/${seanceId}/live`);
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Note de forme
// ----------------------------------------------------------------------------

export async function updateNoteDeForme(
  seanceId: string,
  note: number | null,
): Promise<SeanceActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const check = await requireSeanceEnCours(seanceId, session.user.id);
  if ("error" in check) return { ok: false, error: check.error };

  const safe = note == null ? null : Math.max(1, Math.min(5, Math.round(note)));
  await prisma.seance.update({
    where: { id: seanceId },
    data: { noteDeFormeDuJour: safe },
  });

  revalidatePath(`/seance/${seanceId}/live`);
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Fin / abandon de séance
// ----------------------------------------------------------------------------

const XP_SEANCE = 100;
const XP_PER_PR = 75;
const XP_PER_STREAK_DAY = 5;

export async function finishSeance(
  seanceId: string,
): Promise<
  SeanceActionResult<{
    id: string;
    xpBreakdown: XpBreakdown;
    newPrIds: string[];
    newBadgeIds: string[];
    leveledUp: boolean;
    linkedDefiId: string | null;
  }>
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const check = await requireSeanceEnCours(seanceId, session.user.id);
  if ("error" in check) return { ok: false, error: check.error };

  const seance = await prisma.seance.findUnique({
    where: { id: seanceId },
    select: {
      id: true,
      date: true,
      userId: true,
      sets: {
        where: { validated: true },
        select: { poidsKg: true, bwPlusKg: true, reps: true },
      },
    },
  });
  if (!seance) return { ok: false, error: "Séance introuvable" };

  const user = await prisma.user.findUnique({
    where: { id: seance.userId },
    select: {
      xp: true,
      niveau: true,
      streakActuel: true,
      streakMax: true,
      dernierJourEntrain: true,
    },
  });
  if (!user) return { ok: false, error: "Utilisateur introuvable" };

  const volume = seance.sets.reduce((acc, s) => {
    const chargeKg = (s.poidsKg ?? 0) + (s.bwPlusKg ?? 0);
    return acc + chargeKg * s.reps;
  }, 0);

  const dureeSec = Math.max(
    1,
    Math.round((Date.now() - seance.date.getTime()) / 1000),
  );

  const hasSets = seance.sets.length > 0;

  // 1. Marque la séance terminée (volume / durée). On mettra xpGagne juste après.
  await prisma.seance.update({
    where: { id: seanceId },
    data: {
      statut: "TERMINEE",
      volumeTotalKg: volume,
      dureeSec,
    },
  });

  // 2. Détecte les PRs (crée les PR records liés à cette séance)
  const newPRs = hasSets
    ? await detectAndCreatePRs({ seanceId, userId: seance.userId })
    : [];

  // 3. Calcule la nouvelle streak
  const nextStreak = hasSets
    ? computeNextStreak({
        dernierJourEntrain: user.dernierJourEntrain,
        streakActuel: user.streakActuel,
        streakMax: user.streakMax,
      })
    : null;

  // 4. Calcule le breakdown XP
  const breakdown: XpBreakdown = {
    seance: hasSets ? XP_SEANCE : 0,
    prs: newPRs.length * XP_PER_PR,
    streak: nextStreak ? nextStreak.streakActuel * XP_PER_STREAK_DAY : 0,
    nbPrs: newPRs.length,
    streakActuel: nextStreak?.streakActuel ?? user.streakActuel,
  };
  const xpGagne =
    breakdown.seance + breakdown.prs + breakdown.streak;

  // 5. Calcule niveau avant / après
  const newXp = user.xp + xpGagne;
  const newNiveau = levelFromXp(newXp);
  const leveledUp = newNiveau > user.niveau;

  // 6. Met à jour la séance et le user en transaction
  await prisma.$transaction([
    prisma.seance.update({
      where: { id: seanceId },
      data: { xpGagne },
    }),
    prisma.user.update({
      where: { id: seance.userId },
      data: {
        xp: newXp,
        niveau: newNiveau,
        ...(nextStreak
          ? {
              streakActuel: nextStreak.streakActuel,
              streakMax: nextStreak.streakMax,
              dernierJourEntrain: nextStreak.dernierJourEntrain,
            }
          : {}),
      },
    }),
  ]);

  // 7. Détection badges (après que user.niveau / streak / etc. soient à jour)
  const newBadges = await detectAndAwardBadges({
    userId: seance.userId,
    context: { seanceId, nbPRsCetteSeance: newPRs.length },
  });

  // 8. Recalcule la catégorie de force (peut avoir bougé si nouveau PR)
  const newCategorie = await computeCategorieForce(seance.userId);
  await prisma.user.update({
    where: { id: seance.userId },
    data: { categorie: newCategorie },
  });

  // 9. Si cette séance est attachée à un défi → met à jour la participation
  //    et marque éventuellement le défi comme TERMINE si tout le monde a fini.
  let linkedDefiId: string | null = null;
  const participation = await prisma.defiParticipant.findFirst({
    where: { seanceId, userId: seance.userId },
    select: { id: true, defiId: true },
  });
  if (participation) {
    linkedDefiId = participation.defiId;
    const totalReps = seance.sets.reduce((acc, s) => acc + s.reps, 0);
    await prisma.defiParticipant.update({
      where: { id: participation.id },
      data: {
        statut: "COMPLETE",
        volumeTotalKg: volume,
        dureeSec,
        repsTotal: totalReps,
        completedAt: new Date(),
      },
    });

    // Si tout le monde dans le défi a un statut final (COMPLETE ou REFUSE) → TERMINE
    const remaining = await prisma.defiParticipant.count({
      where: {
        defiId: participation.defiId,
        statut: { in: ["EN_ATTENTE", "ACCEPTE"] },
      },
    });
    if (remaining === 0) {
      await prisma.defi.update({
        where: { id: participation.defiId },
        data: { statut: "TERMINE" },
      });
    }
    revalidatePath("/defis");
    revalidatePath(`/defis/${participation.defiId}`);
  }

  revalidatePath("/");
  revalidatePath("/badges");
  revalidatePath(`/seance/${seanceId}`);
  return {
    ok: true,
    id: seanceId,
    xpBreakdown: breakdown,
    newPrIds: newPRs.map((p) => p.prId),
    newBadgeIds: newBadges.map((b) => b.badgeId),
    leveledUp,
    linkedDefiId,
  };
}

export type XpBreakdown = {
  seance: number;
  prs: number;
  streak: number;
  nbPrs: number;
  streakActuel: number;
};

export async function abortSeance(
  seanceId: string,
): Promise<SeanceActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const check = await requireSeanceEnCours(seanceId, session.user.id);
  if ("error" in check) return { ok: false, error: check.error };

  // Si aucun set validé, on supprime carrément la séance pour pas polluer
  const setCount = await prisma.seanceSet.count({
    where: { seanceId, validated: true },
  });

  if (setCount === 0) {
    await prisma.seance.delete({ where: { id: seanceId } });
  } else {
    await prisma.seance.update({
      where: { id: seanceId },
      data: { statut: "ANNULEE" },
    });
  }

  revalidatePath("/");
  redirect("/");
}

// ----------------------------------------------------------------------------
// Création manuelle d'une séance passée (backfill historique)
// ----------------------------------------------------------------------------

const manualSetSchema = z.object({
  poidsKg: z.coerce.number().min(0).max(1000),
  bwPlusKg: z.coerce.number().min(0).max(500).nullable().optional(),
  reps: z.coerce.number().int().min(1).max(200),
  rir: z.coerce.number().int().min(0).max(20).nullable().optional(),
});

const createManualSeanceSchema = z.object({
  date: z.coerce.date(),
  notes: z.string().max(1000).nullable().optional(),
  exercices: z
    .array(
      z.object({
        exerciceId: z.string().min(1),
        sets: z.array(manualSetSchema).min(1),
      }),
    )
    .min(1, "Au moins un exercice"),
});

export async function createManualSeance(
  input: z.input<typeof createManualSeanceSchema>,
): Promise<SeanceActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const parsed = createManualSeanceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides",
    };
  }
  const data = parsed.data;

  // Vérifie que la date est dans le passé (on n'autorise pas du futur)
  if (data.date.getTime() > Date.now()) {
    return { ok: false, error: "La date doit être dans le passé" };
  }

  // Vérifie l'existence des exos
  const exoIds = [...new Set(data.exercices.map((e) => e.exerciceId))];
  const validExos = await prisma.exercice.findMany({
    where: { id: { in: exoIds } },
    select: { id: true },
  });
  if (validExos.length !== exoIds.length) {
    return { ok: false, error: "Exercice introuvable" };
  }

  const volume = data.exercices.reduce(
    (acc, exo) =>
      acc +
      exo.sets.reduce((sum, s) => {
        const charge = s.poidsKg + (s.bwPlusKg ?? 0);
        return sum + charge * s.reps;
      }, 0),
    0,
  );

  // Pas de XP, pas de streak, pas de PR. C'est du backfill pur.
  const seance = await prisma.seance.create({
    data: {
      userId: session.user.id,
      date: data.date,
      statut: "TERMINEE",
      manuelle: true,
      xpGagne: 0,
      volumeTotalKg: volume,
      notes: data.notes ?? null,
      dureeSec: null,
      sets: {
        create: data.exercices.flatMap((exo) =>
          exo.sets.map((set, setIdx) => ({
            exerciceId: exo.exerciceId,
            ordre: setIdx + 1,
            poidsKg: set.poidsKg,
            bwPlusKg: set.bwPlusKg ?? null,
            reps: set.reps,
            rir: set.rir ?? null,
            validated: true,
            isWarmup: false,
          })),
        ),
      },
    },
    select: { id: true },
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "SEANCE",
    entityId: seance.id,
    metadata: {
      manuelle: true,
      date: data.date.toISOString(),
      volumeKg: volume,
      nbExos: data.exercices.length,
    },
  });

  revalidatePath("/");
  revalidatePath("/stats");
  return { ok: true, id: seance.id };
}

// ----------------------------------------------------------------------------
// Suppression d'une séance
// ----------------------------------------------------------------------------

export async function deleteSeance(
  seanceId: string,
): Promise<SeanceActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const seance = await prisma.seance.findUnique({
    where: { id: seanceId },
    select: { id: true, userId: true },
  });
  if (!seance) return { ok: false, error: "Séance introuvable" };
  if (seance.userId !== session.user.id) {
    return { ok: false, error: "Pas ta séance" };
  }

  // Cascade : SeanceSet supprimés (onDelete: Cascade), PR détaché (SetNull).
  // V1 : on ne rollback ni l'XP, ni le niveau, ni la streak — recalcul cross-séance
  // trop fragile.
  await prisma.seance.delete({ where: { id: seanceId } });

  await logAudit({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "SEANCE",
    entityId: seanceId,
  });

  revalidatePath("/");
  revalidatePath("/stats");
  return { ok: true };
}
