import type { CategorieForce } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const CATEGORIES: CategorieForce[] = [
  "NOVICE",
  "DEBUTANT",
  "INTERMEDIAIRE",
  "AVANCE",
  "EXPERT",
];

// Seuils ratio (1RM / poids de corps) — basé sur les standards classiques de
// force relative. Pour chaque mouvement, on a 5 paliers de difficulté.
const SEUILS: Record<string, [number, number, number, number, number]> = {
  // Développé couché (bench press)
  "developpe-couche": [0.5, 0.75, 1.0, 1.5, 2.0],
  // Squat (back squat)
  squat: [0.75, 1.25, 1.75, 2.25, 2.75],
  // Soulevé de terre (deadlift)
  "souleve-de-terre": [1.0, 1.5, 2.0, 2.5, 3.0],
};

// Slugify simple pour matcher les noms d'exos en BDD (sans accent, kebab)
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Calcule la catégorie de force d'un user en fonction de son meilleur 1RM
 * estimé sur 3 exos repères (développé couché, squat, soulevé de terre).
 * Si l'user n'a pas de poids de corps renseigné, on retourne NOVICE.
 */
export async function computeCategorieForce(userId: string): Promise<CategorieForce> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { poidsKg: true },
  });
  if (!user || !user.poidsKg || user.poidsKg <= 0) return "NOVICE";

  const bw = user.poidsKg;

  // Récupère tous les PRs, on filtrera par nom
  const prs = await prisma.pR.findMany({
    where: { userId },
    select: {
      oneRmKg: true,
      exercice: { select: { nom: true } },
    },
    orderBy: { oneRmKg: "desc" },
  });

  // Pour chaque exo repère, prendre le meilleur 1RM
  const bestByLift = new Map<string, number>();
  for (const pr of prs) {
    const slug = slugify(pr.exercice.nom);
    if (!(slug in SEUILS)) continue;
    const current = bestByLift.get(slug) ?? 0;
    if (pr.oneRmKg > current) bestByLift.set(slug, pr.oneRmKg);
  }

  if (bestByLift.size === 0) return "NOVICE";

  // Pour chaque lift présent, on compte le nombre de seuils franchis
  const liftCategoryIndices: number[] = [];
  for (const [slug, oneRm] of bestByLift) {
    const ratio = oneRm / bw;
    const seuils = SEUILS[slug];
    const passed = seuils.filter((s) => ratio >= s).length;
    // passed va de 0 à 5. On clamp à 0-4 pour mapper aux 5 catégories :
    //   0 ou 1 seuil → NOVICE, 2 → DEBUTANT, 3 → INTERMEDIAIRE, 4 → AVANCE, 5 → EXPERT
    const idx = Math.max(0, Math.min(4, passed - 1));
    liftCategoryIndices.push(idx);
  }

  // Catégorie globale = moyenne arrondie
  const avg =
    liftCategoryIndices.reduce((a, b) => a + b, 0) / liftCategoryIndices.length;
  return CATEGORIES[Math.round(avg)];
}
