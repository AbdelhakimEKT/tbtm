import type { Muscle } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { estimate1RM } from "@/lib/formulas";

export type Period = "mois" | "3mois" | "annee";

export function periodToRange(period: Period): { start: Date; end: Date; days: number } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  const days = period === "mois" ? 30 : period === "3mois" ? 90 : 365;
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { start, end, days };
}

export type StatsBundle = {
  period: Period;
  range: { start: Date; end: Date; days: number };
  summary: {
    seancesCount: number;
    volumeKg: number;
    dureeMoyenneSec: number;
    streakActuel: number;
  };
  heatmap: {
    cells: HeatmapCell[];
    maxVolume: number;
  };
  prs: PRItem[];
  muscleDistribution: MuscleSlice[];
  exoProgression: ExoProgression[];
};

export type HeatmapCell = {
  date: string; // YYYY-MM-DD
  volumeKg: number;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

export type PRItem = {
  prId: string;
  exerciceId: string;
  exerciceNom: string;
  isLeste: boolean;
  poidsKg: number;
  bwPlusKg: number | null;
  reps: number;
  oneRmKg: number;
  date: Date;
};

export type MuscleSlice = {
  muscle: Muscle;
  volumeKg: number;
  pct: number;
};

export type ExoProgression = {
  exerciceId: string;
  exerciceNom: string;
  points: { date: string; oneRm: number; volume: number }[];
};

function dayKey(d: Date): string {
  // En LOCAL (pas UTC) pour que la heatmap matche le calendrier de l'user :
  // une séance faite à 21h locale doit apparaître sur le jour local, pas
  // sur le jour UTC (qui peut être différent dans certains fuseaux).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function buildStats(args: {
  userId: string;
  period: Period;
}): Promise<StatsBundle> {
  const range = periodToRange(args.period);

  // Récupère séances + sets dans la période
  const seances = await prisma.seance.findMany({
    where: {
      userId: args.userId,
      statut: "TERMINEE",
      date: { gte: range.start, lte: range.end },
    },
    select: {
      id: true,
      date: true,
      dureeSec: true,
      volumeTotalKg: true,
      sets: {
        where: { validated: true, isWarmup: false },
        select: {
          poidsKg: true,
          bwPlusKg: true,
          reps: true,
          exerciceId: true,
          exercice: {
            select: { id: true, nom: true, isLeste: true, muscles: true },
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { streakActuel: true },
  });

  // ---- Summary ----
  const seancesCount = seances.length;
  const volumeKg = seances.reduce((acc, s) => acc + s.volumeTotalKg, 0);
  const dureeTotaleSec = seances.reduce((acc, s) => acc + (s.dureeSec ?? 0), 0);
  const dureeMoyenneSec =
    seancesCount > 0 ? Math.round(dureeTotaleSec / seancesCount) : 0;

  // ---- Heatmap ----
  const dailyMap = new Map<string, { volumeKg: number; count: number }>();
  for (const s of seances) {
    const k = dayKey(s.date);
    const existing = dailyMap.get(k) ?? { volumeKg: 0, count: 0 };
    existing.volumeKg += s.volumeTotalKg;
    existing.count += 1;
    dailyMap.set(k, existing);
  }
  // Génère TOUS les jours de la période (même vides)
  const cells: HeatmapCell[] = [];
  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    const k = dayKey(cursor);
    const day = dailyMap.get(k);
    cells.push({
      date: k,
      volumeKg: day?.volumeKg ?? 0,
      count: day?.count ?? 0,
      intensity: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  // Calcule l'intensité (0-4) selon les quantiles du volume
  const nonZeroVolumes = cells
    .map((c) => c.volumeKg)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const maxVolume = nonZeroVolumes[nonZeroVolumes.length - 1] ?? 0;
  if (nonZeroVolumes.length > 0) {
    const q25 = nonZeroVolumes[Math.floor(nonZeroVolumes.length * 0.25)] ?? 0;
    const q50 = nonZeroVolumes[Math.floor(nonZeroVolumes.length * 0.5)] ?? 0;
    const q75 = nonZeroVolumes[Math.floor(nonZeroVolumes.length * 0.75)] ?? 0;
    for (const c of cells) {
      if (c.volumeKg === 0) c.intensity = 0;
      else if (c.volumeKg < q25) c.intensity = 1;
      else if (c.volumeKg < q50) c.intensity = 2;
      else if (c.volumeKg < q75) c.intensity = 3;
      else c.intensity = 4;
    }
  }

  // ---- PRs (tous les PRs de l'utilisateur, pas seulement la période) ----
  const allPRs = await prisma.pR.findMany({
    where: { userId: args.userId },
    orderBy: [{ exerciceId: "asc" }, { oneRmKg: "desc" }],
    select: {
      id: true,
      poidsKg: true,
      bwPlusKg: true,
      reps: true,
      oneRmKg: true,
      date: true,
      exercice: { select: { id: true, nom: true, isLeste: true } },
    },
  });
  // On garde le PR le plus haut par exo
  const bestByExo = new Map<string, (typeof allPRs)[number]>();
  for (const pr of allPRs) {
    const existing = bestByExo.get(pr.exercice.id);
    if (!existing || pr.oneRmKg > existing.oneRmKg) {
      bestByExo.set(pr.exercice.id, pr);
    }
  }
  const prs: PRItem[] = Array.from(bestByExo.values())
    .sort((a, b) => b.oneRmKg - a.oneRmKg)
    .map((pr) => ({
      prId: pr.id,
      exerciceId: pr.exercice.id,
      exerciceNom: pr.exercice.nom,
      isLeste: pr.exercice.isLeste,
      poidsKg: pr.poidsKg,
      bwPlusKg: pr.bwPlusKg,
      reps: pr.reps,
      oneRmKg: pr.oneRmKg,
      date: pr.date,
    }));

  // ---- Muscle distribution (sur la période) ----
  const muscleVolume = new Map<Muscle, number>();
  let totalMuscleVolume = 0;
  for (const s of seances) {
    for (const set of s.sets) {
      const charge =
        (set.poidsKg ?? 0) + (set.bwPlusKg ?? 0);
      const vol = charge * set.reps;
      for (const m of set.exercice.muscles) {
        muscleVolume.set(m, (muscleVolume.get(m) ?? 0) + vol);
        totalMuscleVolume += vol;
      }
    }
  }
  const muscleDistribution: MuscleSlice[] = Array.from(muscleVolume.entries())
    .map(([muscle, volumeKg]) => ({
      muscle,
      volumeKg,
      pct: totalMuscleVolume > 0 ? (volumeKg / totalMuscleVolume) * 100 : 0,
    }))
    .sort((a, b) => b.volumeKg - a.volumeKg);

  // ---- Progression 1RM par exo (sur la période) ----
  // Pour chaque (séance, exo), on garde le meilleur 1RM estimé du jour.
  const progMap = new Map<
    string,
    { exerciceId: string; exerciceNom: string; points: Map<string, { oneRm: number; volume: number }> }
  >();
  for (const s of seances) {
    const k = dayKey(s.date);
    for (const set of s.sets) {
      const charge = set.exercice.isLeste
        ? set.bwPlusKg ?? 0
        : set.poidsKg;
      if (charge <= 0 || set.reps <= 0) continue;
      const oneRm = estimate1RM(charge, set.reps);
      const vol = (set.poidsKg + (set.bwPlusKg ?? 0)) * set.reps;

      const entry =
        progMap.get(set.exercice.id) ??
        {
          exerciceId: set.exercice.id,
          exerciceNom: set.exercice.nom,
          points: new Map(),
        };
      const dayPoint = entry.points.get(k);
      if (!dayPoint || oneRm > dayPoint.oneRm) {
        entry.points.set(k, {
          oneRm,
          volume: (dayPoint?.volume ?? 0) + vol,
        });
      } else {
        entry.points.set(k, {
          oneRm: dayPoint.oneRm,
          volume: dayPoint.volume + vol,
        });
      }
      progMap.set(set.exercice.id, entry);
    }
  }
  const exoProgression: ExoProgression[] = Array.from(progMap.values())
    .map((e) => ({
      exerciceId: e.exerciceId,
      exerciceNom: e.exerciceNom,
      points: Array.from(e.points.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, p]) => ({
          date,
          oneRm: Math.round(p.oneRm * 10) / 10,
          volume: Math.round(p.volume),
        })),
    }))
    .sort((a, b) => b.points.length - a.points.length);

  return {
    period: args.period,
    range,
    summary: {
      seancesCount,
      volumeKg,
      dureeMoyenneSec,
      streakActuel: user?.streakActuel ?? 0,
    },
    heatmap: { cells, maxVolume },
    prs,
    muscleDistribution,
    exoProgression,
  };
}

// ----------------------------------------------------------------------------
// Home dashboard — stats calendaires (mois en cours + semaine en cours + PRs)
// ----------------------------------------------------------------------------

export type HomeDashboard = {
  volumeKgMonth: number;
  volumeDeltaPct: number | null;
  seancesMonth: number;
  seancesDelta: number | null;
  weekVolumesKg: number[];
  recentPRs: { exercice: string; poids: string; delta?: string }[];
};

export async function buildHomeDashboard(userId: string): Promise<HomeDashboard> {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Semaine en cours : lundi 00:00 → lundi suivant 00:00 (lundi = index 0)
  const dayOfWeek = now.getDay(); // 0 = dimanche
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const [thisMonthSeances, lastMonthSeances, weekSeances, recentPRs] = await Promise.all([
    prisma.seance.findMany({
      where: {
        userId,
        statut: "TERMINEE",
        date: { gte: startOfThisMonth, lt: startOfNextMonth },
      },
      select: { volumeTotalKg: true },
    }),
    prisma.seance.findMany({
      where: {
        userId,
        statut: "TERMINEE",
        date: { gte: startOfLastMonth, lt: startOfThisMonth },
      },
      select: { volumeTotalKg: true },
    }),
    prisma.seance.findMany({
      where: {
        userId,
        statut: "TERMINEE",
        date: { gte: startOfWeek, lt: endOfWeek },
      },
      select: { date: true, volumeTotalKg: true },
    }),
    // On fetch 20 PRs récents pour pouvoir dédup par exo et calculer un delta
    // vs le PR précédent du même exo.
    prisma.pR.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 20,
      select: {
        poidsKg: true,
        bwPlusKg: true,
        reps: true,
        oneRmKg: true,
        date: true,
        exerciceId: true,
        exercice: { select: { nom: true, isLeste: true } },
      },
    }),
  ]);

  const volumeKgMonth = thisMonthSeances.reduce((acc, s) => acc + s.volumeTotalKg, 0);
  const volumeKgLastMonth = lastMonthSeances.reduce((acc, s) => acc + s.volumeTotalKg, 0);
  const volumeDeltaPct =
    volumeKgLastMonth > 0
      ? Math.round(((volumeKgMonth - volumeKgLastMonth) / volumeKgLastMonth) * 100)
      : null;

  const seancesMonth = thisMonthSeances.length;
  const seancesLastMonth = lastMonthSeances.length;
  const seancesDelta = seancesLastMonth > 0 ? seancesMonth - seancesLastMonth : null;

  const weekVolumesKg = [0, 0, 0, 0, 0, 0, 0];
  for (const s of weekSeances) {
    const idx = (s.date.getDay() + 6) % 7;
    weekVolumesKg[idx] += s.volumeTotalKg;
  }

  // Garde le PR le plus récent par exo, puis calcule le delta vs le précédent
  // PR du même exo s'il existe (dans la fenêtre des 20 récents).
  const seen = new Set<string>();
  const topByExo: typeof recentPRs = [];
  const previousByExo = new Map<string, (typeof recentPRs)[number]>();
  for (const pr of recentPRs) {
    if (!seen.has(pr.exerciceId)) {
      seen.add(pr.exerciceId);
      topByExo.push(pr);
    } else if (!previousByExo.has(pr.exerciceId)) {
      previousByExo.set(pr.exerciceId, pr);
    }
    if (topByExo.length >= 3 && previousByExo.size >= topByExo.length) break;
  }

  const formatPoids = (pr: (typeof recentPRs)[number]) => {
    if (pr.exercice.isLeste) {
      const add = pr.bwPlusKg ?? 0;
      const suffix = `× ${pr.reps}`;
      return add > 0 ? `BW+${add}kg ${suffix}` : `BW ${suffix}`;
    }
    return `${pr.poidsKg}kg × ${pr.reps}`;
  };

  const formattedRecentPRs = topByExo.slice(0, 3).map((pr) => {
    const prev = previousByExo.get(pr.exerciceId);
    let delta: string | undefined;
    if (prev && pr.oneRmKg > prev.oneRmKg) {
      const diff = Math.round((pr.oneRmKg - prev.oneRmKg) * 10) / 10;
      delta = `+${diff}kg`;
    }
    return {
      exercice: pr.exercice.nom,
      poids: formatPoids(pr),
      delta,
    };
  });

  return {
    volumeKgMonth,
    volumeDeltaPct,
    seancesMonth,
    seancesDelta,
    weekVolumesKg,
    recentPRs: formattedRecentPRs,
  };
}
