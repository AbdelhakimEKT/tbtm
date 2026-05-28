"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const pseudoSchema = z
  .string()
  .min(3, "Pseudo trop court")
  .max(24, "Pseudo trop long")
  .regex(/^[a-zA-Z0-9_-]+$/, "Caractères invalides");

/**
 * Envoie une demande d'ami à un user par son pseudo.
 * - Si l'autre m'a déjà envoyé une demande → auto-accept (handshake).
 * - Si on est déjà amis → no-op.
 * - Si demande en cours dans un sens → no-op.
 */
export async function sendFriendRequest(
  formData: FormData,
): Promise<ActionResult<{ kind: "sent" | "accepted-instant" }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const raw = formData.get("pseudo");
  const parsed = pseudoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }
  const pseudo = parsed.data;

  const target = await prisma.user.findUnique({
    where: { pseudo },
    select: { id: true, pseudo: true },
  });
  if (!target) {
    return { ok: false, error: `Aucun user avec le pseudo "${pseudo}"` };
  }
  if (target.id === session.user.id) {
    return { ok: false, error: "Tu peux pas te défier toi-même" };
  }

  // Existe-t-il déjà une relation dans un sens ou l'autre ?
  const existing = await prisma.amitie.findFirst({
    where: {
      OR: [
        { deId: session.user.id, aId: target.id },
        { deId: target.id, aId: session.user.id },
      ],
    },
  });

  if (existing) {
    if (existing.statut === "ACCEPTEE") {
      return { ok: false, error: `Tu es déjà ami avec ${target.pseudo}` };
    }
    if (existing.statut === "BLOQUEE") {
      return { ok: false, error: "Pas possible" };
    }
    // EN_ATTENTE
    if (existing.deId === session.user.id) {
      return { ok: false, error: "Demande déjà envoyée — attends sa réponse" };
    }
    // L'autre m'a déjà envoyé une demande → on accepte directement
    await prisma.amitie.update({
      where: { id: existing.id },
      data: { statut: "ACCEPTEE" },
    });
    revalidatePath("/amis");
    revalidatePath("/profil");
    return { ok: true, kind: "accepted-instant" };
  }

  await prisma.amitie.create({
    data: {
      deId: session.user.id,
      aId: target.id,
      statut: "EN_ATTENTE",
    },
  });

  revalidatePath("/amis");
  return { ok: true, kind: "sent" };
}

export async function acceptFriendRequest(
  amitieId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const amitie = await prisma.amitie.findUnique({
    where: { id: amitieId },
    select: { aId: true, statut: true },
  });
  if (!amitie) return { ok: false, error: "Demande introuvable" };
  if (amitie.aId !== session.user.id) {
    return { ok: false, error: "Pas tes droits" };
  }
  if (amitie.statut !== "EN_ATTENTE") {
    return { ok: false, error: "Demande déjà traitée" };
  }

  await prisma.amitie.update({
    where: { id: amitieId },
    data: { statut: "ACCEPTEE" },
  });

  revalidatePath("/amis");
  revalidatePath("/profil");
  return { ok: true };
}

export async function rejectFriendRequest(
  amitieId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const amitie = await prisma.amitie.findUnique({
    where: { id: amitieId },
    select: { aId: true, statut: true },
  });
  if (!amitie) return { ok: false, error: "Demande introuvable" };
  if (amitie.aId !== session.user.id) {
    return { ok: false, error: "Pas tes droits" };
  }
  if (amitie.statut !== "EN_ATTENTE") {
    return { ok: false, error: "Demande déjà traitée" };
  }

  await prisma.amitie.delete({ where: { id: amitieId } });

  revalidatePath("/amis");
  return { ok: true };
}

export async function cancelSentRequest(
  amitieId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const amitie = await prisma.amitie.findUnique({
    where: { id: amitieId },
    select: { deId: true, statut: true },
  });
  if (!amitie) return { ok: false, error: "Demande introuvable" };
  if (amitie.deId !== session.user.id) {
    return { ok: false, error: "Pas tes droits" };
  }
  if (amitie.statut !== "EN_ATTENTE") {
    return { ok: false, error: "Demande déjà traitée" };
  }

  await prisma.amitie.delete({ where: { id: amitieId } });

  revalidatePath("/amis");
  return { ok: true };
}

export async function removeFriend(
  otherUserId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi d'abord" };

  const amitie = await prisma.amitie.findFirst({
    where: {
      OR: [
        { deId: session.user.id, aId: otherUserId },
        { deId: otherUserId, aId: session.user.id },
      ],
      statut: "ACCEPTEE",
    },
    select: { id: true },
  });
  if (!amitie) return { ok: false, error: "Pas amis" };

  await prisma.amitie.delete({ where: { id: amitie.id } });

  revalidatePath("/amis");
  revalidatePath("/profil");
  return { ok: true };
}
