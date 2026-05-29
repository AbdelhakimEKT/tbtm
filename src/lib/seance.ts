import { prisma } from "@/lib/prisma";
import { estimate1RM } from "@/lib/formulas";

export type Suggestion = {
  poidsKg: number | null;
  bwPlusKg: number | null;
  // raison textuelle pour expliquer la valeur suggérée
  reason: "no-history" | "last-session" | "planned";
  // Valeurs de référence pour qu'on puisse afficher "t'as fait Xkg × Y la dernière fois"
  fromPoidsKg: number | null;
  fromBwPlusKg: number | null;
  fromReps: number | null;
  // Reps atteintes lors de la dernière séance (utile pour suggérer manuellement +2.5kg
  // au user, sans le forcer)
  hitTargetLastTime: boolean;
};

/**
 * Suggère la charge pour la prochaine séance d'un exercice. Règle simple :
 *  - Si pas d'historique → on prend le poids cible du programme
 *  - Sinon → on suggère EXACTEMENT le même poids que la dernière fois
 *
 * Pas de +2.5kg auto (le user trouve ça pas prévisible). Le client peut afficher
 * un hint "tu as battu tes reps cibles la dernière fois, tente +2.5kg" mais
 * c'est lui qui applique l'incrément, pas nous.
 *
 * Travaille avec `bwPlusKg` pour les exos lestés (poids du corps + X),
 * et `poidsKg` sinon.
 */
export async function getSuggestionForExercice(args: {
  userId: string;
  exerciceId: string;
  isLeste: boolean;
  plannedPoidsKg: number | null;
  plannedBwPlusKg: number | null;
  plannedReps: number;
}): Promise<Suggestion> {
  const { userId, exerciceId, isLeste, plannedPoidsKg, plannedBwPlusKg, plannedReps } = args;

  // Dernière séance terminée avec au moins une série validée sur cet exo
  const lastSet = await prisma.seanceSet.findFirst({
    where: {
      seance: { userId, statut: "TERMINEE" },
      exerciceId,
      validated: true,
      isWarmup: false,
    },
    orderBy: [{ seance: { date: "desc" } }, { ordre: "desc" }],
    select: {
      poidsKg: true,
      bwPlusKg: true,
      reps: true,
    },
  });

  if (!lastSet) {
    return {
      poidsKg: plannedPoidsKg,
      bwPlusKg: plannedBwPlusKg,
      reason: plannedPoidsKg != null || plannedBwPlusKg != null ? "planned" : "no-history",
      fromPoidsKg: null,
      fromBwPlusKg: null,
      fromReps: null,
      hitTargetLastTime: false,
    };
  }

  return {
    poidsKg: lastSet.poidsKg,
    bwPlusKg: lastSet.bwPlusKg,
    reason: "last-session",
    fromPoidsKg: lastSet.poidsKg,
    fromBwPlusKg: lastSet.bwPlusKg,
    fromReps: lastSet.reps,
    hitTargetLastTime: lastSet.reps >= plannedReps,
  };
}

/**
 * Calcule la durée d'une séance en cours (côté serveur).
 * Pour la durée live qui s'incrémente, c'est le client qui tient le timer.
 */
export function dureeSeance(seance: { date: Date }): number {
  return Math.max(0, Math.floor((Date.now() - seance.date.getTime()) / 1000));
}

/**
 * Format mm:ss
 */
export function formatDureeMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Format hh:mm:ss si > 1h, sinon mm:ss
 */
export function formatDuree(sec: number): string {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return formatDureeMMSS(sec);
}

// ----------------------------------------------------------------------------
// Gamification : niveau, streak, PR
// ----------------------------------------------------------------------------

/**
 * XP cumulé requis pour atteindre un niveau N (palier triangulaire).
 *   level 1 = 0 XP (start)
 *   level 2 = 100 XP
 *   level 3 = 300 XP cumul
 *   level 4 = 600 XP cumul
 *   level 5 = 1000 XP cumul
 *   level N = 100 × N × (N-1) / 2
 */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  return (100 * level * (level - 1)) / 2;
}

/**
 * Niveau correspondant à un total d'XP. Inverse de xpRequiredForLevel.
 * On résout 100 × N × (N-1) / 2 ≤ xp → N(N-1) ≤ xp/50
 */
export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  // N(N-1) ≤ xp/50 → N ≤ (1 + sqrt(1 + 4*xp/50)) / 2
  const n = Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2);
  return Math.max(1, n);
}

/**
 * Calcule l'XP requis pour le prochain niveau et la progression actuelle.
 */
export function xpProgress(xp: number) {
  const niveau = levelFromXp(xp);
  const xpDebutNiveau = xpRequiredForLevel(niveau);
  const xpFinNiveau = xpRequiredForLevel(niveau + 1);
  const dansPalier = xp - xpDebutNiveau;
  const cible = xpFinNiveau - xpDebutNiveau;
  return {
    niveau,
    xpDansPalier: dansPalier,
    xpPourPalier: cible,
    pct: cible > 0 ? Math.min(100, (dansPalier / cible) * 100) : 0,
  };
}

/**
 * Met à jour la streak en fonction du dernier jour d'entraînement.
 * Règles :
 *  - Si jamais entraîné → streak = 1
 *  - Si dernière fois aujourd'hui → pas de changement (déjà compté)
 *  - Si dernière fois il y a 1 à 4 jours → streak += 1
 *  - Si > 4 jours → streak = 1 (reset)
 */
export function computeNextStreak(args: {
  dernierJourEntrain: Date | null;
  streakActuel: number;
  streakMax: number;
  today?: Date;
}): { streakActuel: number; streakMax: number; dernierJourEntrain: Date } {
  const today = args.today ?? new Date();
  const todayKey = dayKey(today);

  if (!args.dernierJourEntrain) {
    return {
      streakActuel: 1,
      streakMax: Math.max(args.streakMax, 1),
      dernierJourEntrain: today,
    };
  }

  const lastKey = dayKey(args.dernierJourEntrain);
  if (todayKey === lastKey) {
    return {
      streakActuel: args.streakActuel,
      streakMax: args.streakMax,
      dernierJourEntrain: today,
    };
  }

  const daysSince = Math.round(
    (today.getTime() - args.dernierJourEntrain.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSince >= 1 && daysSince <= 4) {
    const next = args.streakActuel + 1;
    return {
      streakActuel: next,
      streakMax: Math.max(args.streakMax, next),
      dernierJourEntrain: today,
    };
  }

  return {
    streakActuel: 1,
    streakMax: Math.max(args.streakMax, 1),
    dernierJourEntrain: today,
  };
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ----------------------------------------------------------------------------
// Historique : N dernières séances sur un exo (pour affichage style carnet)
// ----------------------------------------------------------------------------

export type ExerciceHistorySession = {
  seanceId: string;
  date: Date;
  sets: { poidsKg: number; bwPlusKg: number | null; reps: number; rir: number | null }[];
};

export async function getRecentSessionsForExercice(args: {
  userId: string;
  exerciceId: string;
  excludeSeanceId?: string;
  limit?: number;
}): Promise<ExerciceHistorySession[]> {
  const limit = args.limit ?? 3;
  const sessions = await prisma.seance.findMany({
    where: {
      userId: args.userId,
      statut: "TERMINEE",
      ...(args.excludeSeanceId ? { id: { not: args.excludeSeanceId } } : {}),
      sets: {
        some: {
          exerciceId: args.exerciceId,
          validated: true,
          isWarmup: false,
        },
      },
    },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      date: true,
      sets: {
        where: {
          exerciceId: args.exerciceId,
          validated: true,
          isWarmup: false,
        },
        orderBy: { ordre: "asc" },
        select: {
          poidsKg: true,
          bwPlusKg: true,
          reps: true,
          rir: true,
        },
      },
    },
  });

  return sessions.map((s) => ({
    seanceId: s.id,
    date: s.date,
    sets: s.sets,
  }));
}

// ----------------------------------------------------------------------------
// Détection PR
// ----------------------------------------------------------------------------

export type NewPR = {
  prId: string;
  exerciceId: string;
  exerciceNom: string;
  isLeste: boolean;
  poidsKg: number;
  bwPlusKg: number | null;
  reps: number;
  oneRmKg: number;
  previousOneRmKg: number | null;
};

/**
 * Détecte les nouveaux records personnels sur cette séance et crée les PR
 * correspondants. Compare le meilleur set de chaque exo (selon 1RM estimé)
 * au PR existant le plus élevé pour cet user × exo.
 *
 * À appeler depuis finishSeance après que les sets soient persistés et que
 * le statut soit TERMINEE.
 */
export async function detectAndCreatePRs(args: {
  seanceId: string;
  userId: string;
}): Promise<NewPR[]> {
  const sets = await prisma.seanceSet.findMany({
    where: { seanceId: args.seanceId, validated: true, isWarmup: false },
    select: {
      exerciceId: true,
      poidsKg: true,
      bwPlusKg: true,
      reps: true,
      exercice: { select: { nom: true, isLeste: true } },
    },
  });

  if (sets.length === 0) return [];

  // Groupe par exerciceId et garde le meilleur set (1RM max)
  const bestByExo = new Map<
    string,
    {
      poidsKg: number;
      bwPlusKg: number | null;
      reps: number;
      oneRmKg: number;
      exerciceNom: string;
      isLeste: boolean;
    }
  >();
  for (const s of sets) {
    const chargeKg = s.exercice.isLeste
      ? s.bwPlusKg ?? 0
      : s.poidsKg;
    if (chargeKg <= 0 && s.reps <= 0) continue;
    const oneRm = estimate1RM(chargeKg, s.reps);
    const existing = bestByExo.get(s.exerciceId);
    if (!existing || oneRm > existing.oneRmKg) {
      bestByExo.set(s.exerciceId, {
        poidsKg: s.poidsKg,
        bwPlusKg: s.bwPlusKg,
        reps: s.reps,
        oneRmKg: oneRm,
        exerciceNom: s.exercice.nom,
        isLeste: s.exercice.isLeste,
      });
    }
  }

  const newPRs: NewPR[] = [];

  for (const [exerciceId, best] of bestByExo) {
    const previous = await prisma.pR.findFirst({
      where: { userId: args.userId, exerciceId },
      orderBy: { oneRmKg: "desc" },
      select: { oneRmKg: true },
    });

    if (previous && best.oneRmKg <= previous.oneRmKg) continue;

    const created = await prisma.pR.create({
      data: {
        userId: args.userId,
        exerciceId,
        seanceId: args.seanceId,
        poidsKg: best.poidsKg,
        bwPlusKg: best.bwPlusKg,
        reps: best.reps,
        oneRmKg: best.oneRmKg,
      },
      select: { id: true },
    });

    newPRs.push({
      prId: created.id,
      exerciceId,
      exerciceNom: best.exerciceNom,
      isLeste: best.isLeste,
      poidsKg: best.poidsKg,
      bwPlusKg: best.bwPlusKg,
      reps: best.reps,
      oneRmKg: best.oneRmKg,
      previousOneRmKg: previous?.oneRmKg ?? null,
    });
  }

  return newPRs;
}
