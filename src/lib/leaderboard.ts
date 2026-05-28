import type { CategorieForce } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type LeaderboardEntry = {
  rank: number;
  user: {
    id: string;
    pseudo: string;
    avatar: string | null;
    niveau: number;
    categorie: CategorieForce;
  };
  volumeKg: number;
  seancesCount: number;
  isMe: boolean;
};

export type LeaderboardBundle = {
  entries: LeaderboardEntry[];
  monthLabel: string;
  monthStart: Date;
  monthEnd: Date;
  myEntry: LeaderboardEntry | null; // si user pas dans top, on l'inclut séparément
};

function currentMonthRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = now.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  return { start, end, label };
}

/**
 * Construit le classement pour un set d'utilisateurs (ou tous), trié par
 * volume mensuel décroissant. N'inclut que les users ayant fait ≥ 1 séance
 * terminée dans la période.
 */
export async function buildLeaderboard(args: {
  meId: string;
  userIds?: string[]; // si fourni : restreint à ces users (cas "Amis"). Sinon : tous.
  limit?: number;
}): Promise<LeaderboardBundle> {
  const { start, end, label } = currentMonthRange();
  const limit = args.limit ?? 50;

  // 1. Agrège volume + count par user
  const groups = await prisma.seance.groupBy({
    by: ["userId"],
    where: {
      statut: "TERMINEE",
      date: { gte: start, lte: end },
      ...(args.userIds ? { userId: { in: args.userIds } } : {}),
    },
    _sum: { volumeTotalKg: true },
    _count: { _all: true },
  });

  if (groups.length === 0) {
    return {
      entries: [],
      monthLabel: label,
      monthStart: start,
      monthEnd: end,
      myEntry: null,
    };
  }

  // 2. Trie par volume desc + applique la limite
  const sorted = groups
    .map((g) => ({
      userId: g.userId,
      volumeKg: g._sum.volumeTotalKg ?? 0,
      seancesCount: g._count._all,
    }))
    .filter((g) => g.volumeKg > 0)
    .sort((a, b) => b.volumeKg - a.volumeKg);

  const topUserIds = sorted.slice(0, limit).map((s) => s.userId);

  // 3. Fetch user info
  const users = await prisma.user.findMany({
    where: { id: { in: topUserIds } },
    select: {
      id: true,
      pseudo: true,
      avatar: true,
      niveau: true,
      categorie: true,
    },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // 4. Construit les entries dans l'ordre du tri
  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < Math.min(sorted.length, limit); i++) {
    const s = sorted[i];
    const u = userMap.get(s.userId);
    if (!u) continue;
    entries.push({
      rank: i + 1,
      user: u,
      volumeKg: s.volumeKg,
      seancesCount: s.seancesCount,
      isMe: s.userId === args.meId,
    });
  }

  // 5. Si je suis pas dans le top, retrouve ma place pour l'afficher séparément
  const meInTop = entries.find((e) => e.isMe);
  let myEntry: LeaderboardEntry | null = meInTop ?? null;
  if (!meInTop) {
    const myIndex = sorted.findIndex((s) => s.userId === args.meId);
    if (myIndex >= 0) {
      const s = sorted[myIndex];
      // Re-fetch my user info (pas dans userMap)
      const me = await prisma.user.findUnique({
        where: { id: args.meId },
        select: {
          id: true,
          pseudo: true,
          avatar: true,
          niveau: true,
          categorie: true,
        },
      });
      if (me) {
        myEntry = {
          rank: myIndex + 1,
          user: me,
          volumeKg: s.volumeKg,
          seancesCount: s.seancesCount,
          isMe: true,
        };
      }
    }
  }

  return {
    entries,
    monthLabel: label,
    monthStart: start,
    monthEnd: end,
    myEntry,
  };
}

/**
 * Récupère les IDs des amis acceptés du user (dans les deux sens d'amitié).
 * Inclut le user lui-même (pour qu'il apparaisse dans le classement amis).
 */
export async function getFriendIdsIncludingMe(userId: string): Promise<string[]> {
  const amities = await prisma.amitie.findMany({
    where: {
      statut: "ACCEPTEE",
      OR: [{ deId: userId }, { aId: userId }],
    },
    select: { deId: true, aId: true },
  });
  const ids = new Set<string>([userId]);
  for (const a of amities) {
    ids.add(a.deId === userId ? a.aId : a.deId);
  }
  return Array.from(ids);
}
