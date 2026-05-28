import { prisma } from "@/lib/prisma";

export type AwardedBadge = {
  badgeId: string;
  slug: string;
  nom: string;
  description: string;
  icone: string;
  rarete: "COMMUN" | "RARE" | "EPIQUE" | "LEGENDAIRE" | "MYSTERE";
};

/**
 * Vérifie tous les badges débloquables pour cet utilisateur en se basant sur
 * son état actuel + le contexte de la dernière séance. Crée les UserBadges
 * manquants en BDD et retourne la liste des badges fraîchement débloqués.
 *
 * Idempotent : si le badge est déjà unlock, on ne le re-débloque pas.
 */
export async function detectAndAwardBadges(args: {
  userId: string;
  context?: {
    seanceId?: string;
    nbPRsCetteSeance?: number;
  };
}): Promise<AwardedBadge[]> {
  // 1. État actuel du user
  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: {
      niveau: true,
      streakActuel: true,
    },
  });
  if (!user) return [];

  // 2. Stats cumulatives (séances terminées + volume + PRs + recettes)
  const [seancesTotal, volumeAgg, prsTotal, recettesTotal, defisLances, userBadges] =
    await Promise.all([
      prisma.seance.count({
        where: { userId: args.userId, statut: "TERMINEE" },
      }),
      prisma.seance.aggregate({
        where: { userId: args.userId, statut: "TERMINEE" },
        _sum: { volumeTotalKg: true },
      }),
      prisma.pR.count({ where: { userId: args.userId } }),
      prisma.recette.count({ where: { createdById: args.userId } }),
      prisma.defi.count({ where: { lanceParId: args.userId } }),
      prisma.userBadge.findMany({
        where: { userId: args.userId },
        select: { badgeId: true },
      }),
    ]);
  const volumeTotalKg = volumeAgg._sum.volumeTotalKg ?? 0;
  const alreadyOwnedBadgeIds = new Set(userBadges.map((ub) => ub.badgeId));

  // 3. Tous les badges existants en BDD
  const allBadges = await prisma.badge.findMany({
    select: {
      id: true,
      slug: true,
      nom: true,
      description: true,
      icone: true,
      rarete: true,
    },
  });

  // 4. Pour chaque badge : check si la condition est remplie
  const toUnlock: AwardedBadge[] = [];
  for (const b of allBadges) {
    if (alreadyOwnedBadgeIds.has(b.id)) continue;
    const ok = checkBadgeCondition(b.slug, {
      prsTotal,
      seancesTotal,
      volumeTotalKg,
      niveau: user.niveau,
      streakActuel: user.streakActuel,
      recettesTotal,
      defisLances,
      nbPRsCetteSeance: args.context?.nbPRsCetteSeance ?? 0,
    });
    if (ok) {
      toUnlock.push({
        badgeId: b.id,
        slug: b.slug,
        nom: b.nom,
        description: b.description,
        icone: b.icone,
        rarete: b.rarete,
      });
    }
  }

  if (toUnlock.length === 0) return [];

  // 5. Crée les UserBadges en BDD
  await prisma.userBadge.createMany({
    data: toUnlock.map((b) => ({
      userId: args.userId,
      badgeId: b.badgeId,
    })),
    skipDuplicates: true,
  });

  return toUnlock;
}

type BadgeContext = {
  prsTotal: number;
  seancesTotal: number;
  volumeTotalKg: number;
  niveau: number;
  streakActuel: number;
  recettesTotal: number;
  defisLances: number;
  nbPRsCetteSeance: number;
};

function checkBadgeCondition(slug: string, ctx: BadgeContext): boolean {
  switch (slug) {
    case "premier-pr":
      return ctx.prsTotal >= 1;

    case "streak-7":
      return ctx.streakActuel >= 7;
    case "streak-30":
      return ctx.streakActuel >= 30;
    case "streak-100":
      return ctx.streakActuel >= 100;

    case "10-seances":
      return ctx.seancesTotal >= 10;
    case "50-seances":
      return ctx.seancesTotal >= 50;
    case "100-seances":
      return ctx.seancesTotal >= 100;
    case "500-seances":
      return ctx.seancesTotal >= 500;

    case "volume-10t":
      return ctx.volumeTotalKg >= 10_000;
    case "volume-50t":
      return ctx.volumeTotalKg >= 50_000;
    case "volume-100t":
      return ctx.volumeTotalKg >= 100_000;
    case "volume-1000t":
      return ctx.volumeTotalKg >= 1_000_000;

    case "premier-defi":
      return ctx.defisLances >= 1;
    // premier-defi-gagne : Phase 9
    case "premiere-recette":
      return ctx.recettesTotal >= 1;

    case "niveau-5":
      return ctx.niveau >= 5;
    case "niveau-10":
      return ctx.niveau >= 10;
    case "niveau-20":
      return ctx.niveau >= 20;

    case "mystere":
      // Easter egg : claquer 5 PRs ou plus dans une seule séance.
      return ctx.nbPRsCetteSeance >= 5;

    default:
      return false;
  }
}
