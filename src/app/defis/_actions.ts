"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

// ----------------------------------------------------------------------------
// Création
// ----------------------------------------------------------------------------

const createDefiSchema = z.object({
  programmeId: z.string().min(1),
  friendIds: z.array(z.string().min(1)).min(1, "Sélectionne au moins un pote").max(20),
  titre: z.string().trim().max(80).nullable().optional()
    .or(z.literal("").transform(() => null)),
  message: z.string().trim().max(300).nullable().optional()
    .or(z.literal("").transform(() => null)),
});

export async function createDefi(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const raw = {
    programmeId: formData.get("programmeId"),
    friendIds: formData.getAll("friendIds"),
    titre: formData.get("titre") || null,
    message: formData.get("message") || null,
  };
  const parsed = createDefiSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }

  // Vérif accès programme (créateur, admin, ou visible)
  const programme = await prisma.programme.findUnique({
    where: { id: parsed.data.programmeId },
    select: {
      createdById: true,
      visibilite: true,
      exercices: { select: { id: true }, take: 1 },
    },
  });
  if (!programme) return { ok: false, error: "Programme introuvable" };
  const canUse =
    programme.createdById === session.user.id ||
    session.user.role === "ADMIN" ||
    programme.visibilite !== "PRIVE";
  if (!canUse) return { ok: false, error: "Programme pas accessible" };
  if (programme.exercices.length === 0) {
    return { ok: false, error: "Programme vide" };
  }

  // Vérif que tous les friendIds sont bien mes amis acceptés
  const friendIds = parsed.data.friendIds.filter((id) => id !== session.user.id);
  if (friendIds.length === 0) {
    return { ok: false, error: "Sélectionne au moins un pote" };
  }
  const amities = await prisma.amitie.findMany({
    where: {
      statut: "ACCEPTEE",
      OR: friendIds.flatMap((fid) => [
        { deId: session.user.id, aId: fid },
        { deId: fid, aId: session.user.id },
      ]),
    },
    select: { deId: true, aId: true },
  });
  const validFriendIds = new Set<string>();
  for (const a of amities) {
    validFriendIds.add(a.deId === session.user.id ? a.aId : a.deId);
  }
  const invalid = friendIds.filter((id) => !validFriendIds.has(id));
  if (invalid.length > 0) {
    return { ok: false, error: "Tu peux défier que tes potes acceptés" };
  }

  // Crée le défi + les participants (moi en ACCEPTE auto, les autres en EN_ATTENTE)
  const defi = await prisma.defi.create({
    data: {
      titre: parsed.data.titre,
      message: parsed.data.message,
      programmeId: parsed.data.programmeId,
      lanceParId: session.user.id,
      statut: "EN_COURS",
      participants: {
        create: [
          { userId: session.user.id, statut: "ACCEPTE" },
          ...friendIds.map((id) => ({ userId: id, statut: "EN_ATTENTE" as const })),
        ],
      },
    },
    select: { id: true },
  });

  revalidatePath("/defis");
  return { ok: true, id: defi.id };
}

// ----------------------------------------------------------------------------
// Accept / Refuse / Cancel
// ----------------------------------------------------------------------------

export async function acceptDefi(
  defiParticipantId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const dp = await prisma.defiParticipant.findUnique({
    where: { id: defiParticipantId },
    select: { userId: true, statut: true, defiId: true },
  });
  if (!dp) return { ok: false, error: "Défi introuvable" };
  if (dp.userId !== session.user.id) {
    return { ok: false, error: "Pas pour toi" };
  }
  if (dp.statut !== "EN_ATTENTE") {
    return { ok: false, error: "Déjà traité" };
  }

  await prisma.defiParticipant.update({
    where: { id: defiParticipantId },
    data: { statut: "ACCEPTE" },
  });

  revalidatePath("/defis");
  revalidatePath(`/defis/${dp.defiId}`);
  return { ok: true };
}

export async function refuseDefi(
  defiParticipantId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const dp = await prisma.defiParticipant.findUnique({
    where: { id: defiParticipantId },
    select: { userId: true, statut: true, defiId: true },
  });
  if (!dp) return { ok: false, error: "Défi introuvable" };
  if (dp.userId !== session.user.id) {
    return { ok: false, error: "Pas pour toi" };
  }
  if (dp.statut !== "EN_ATTENTE") {
    return { ok: false, error: "Déjà traité" };
  }

  await prisma.defiParticipant.update({
    where: { id: defiParticipantId },
    data: { statut: "REFUSE" },
  });

  revalidatePath("/defis");
  revalidatePath(`/defis/${dp.defiId}`);
  return { ok: true };
}

export async function cancelDefi(
  defiId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const defi = await prisma.defi.findUnique({
    where: { id: defiId },
    select: { lanceParId: true, statut: true },
  });
  if (!defi) return { ok: false, error: "Défi introuvable" };
  if (defi.lanceParId !== session.user.id && session.user.role !== "ADMIN") {
    return { ok: false, error: "Pas tes droits" };
  }

  await prisma.defi.update({
    where: { id: defiId },
    data: { statut: "ANNULE" },
  });

  revalidatePath("/defis");
  revalidatePath(`/defis/${defiId}`);
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Commentaires (chambrage)
// ----------------------------------------------------------------------------

const commentSchema = z.object({
  message: z.string().trim().min(1, "Vide").max(500, "Trop long"),
});

export async function postDefiComment(
  defiId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const parsed = commentSchema.safeParse({
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }

  // Vérif que je suis bien participant du défi
  const participant = await prisma.defiParticipant.findFirst({
    where: { defiId, userId: session.user.id },
    select: { id: true },
  });
  if (!participant) {
    return { ok: false, error: "Tu fais pas partie de ce défi" };
  }

  const comment = await prisma.defiCommentaire.create({
    data: {
      defiId,
      userId: session.user.id,
      message: parsed.data.message,
    },
    select: { id: true },
  });

  revalidatePath(`/defis/${defiId}`);
  return { ok: true, id: comment.id };
}

export async function deleteDefiComment(
  commentId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const comment = await prisma.defiCommentaire.findUnique({
    where: { id: commentId },
    select: { userId: true, defiId: true },
  });
  if (!comment) return { ok: false, error: "Introuvable" };
  if (comment.userId !== session.user.id && session.user.role !== "ADMIN") {
    return { ok: false, error: "Pas tes droits" };
  }

  await prisma.defiCommentaire.delete({ where: { id: commentId } });

  revalidatePath(`/defis/${comment.defiId}`);
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Lancer ma séance pour ce défi (form action, redirect vers /seance/[id]/live)
// ----------------------------------------------------------------------------

export async function startSeanceForDefi(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const defiParticipantId = formData.get("defiParticipantId");
  if (typeof defiParticipantId !== "string" || !defiParticipantId) {
    redirect("/defis");
  }

  const dp = await prisma.defiParticipant.findUnique({
    where: { id: defiParticipantId },
    select: {
      id: true,
      userId: true,
      statut: true,
      seanceId: true,
      defiId: true,
      defi: {
        select: { programmeId: true, statut: true },
      },
    },
  });
  if (!dp) redirect("/defis");
  if (dp.userId !== session.user.id) redirect("/defis");
  if (dp.defi.statut !== "EN_COURS") redirect(`/defis/${dp.defiId}`);
  if (dp.statut === "COMPLETE") redirect(`/defis/${dp.defiId}`);

  // Si déjà en cours, reprends
  if (dp.seanceId) {
    redirect(`/seance/${dp.seanceId}/live`);
  }

  const newSeance = await prisma.seance.create({
    data: {
      userId: session.user.id,
      programmeId: dp.defi.programmeId,
      statut: "EN_COURS",
    },
    select: { id: true },
  });

  // Marque le participant : ACCEPTE + lié à la séance
  await prisma.defiParticipant.update({
    where: { id: defiParticipantId },
    data: {
      statut: "ACCEPTE",
      seanceId: newSeance.id,
    },
  });

  revalidatePath("/");
  redirect(`/seance/${newSeance.id}/live`);
}
