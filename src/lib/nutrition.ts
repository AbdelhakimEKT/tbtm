import type { NiveauActivite, Objectif, PortionType, Sexe } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// ----------------------------------------------------------------------------
// TDEE (Total Daily Energy Expenditure)
// ----------------------------------------------------------------------------

const ACTIVITE_MULT: Record<NiveauActivite, number> = {
  SEDENTAIRE: 1.2,
  LEGER: 1.375,
  MODERE: 1.55,
  ACTIF: 1.725,
  TRES_ACTIF: 1.9,
};

const OBJECTIF_KCAL_DELTA: Record<Objectif, number> = {
  PRISE_DE_MASSE: 350,
  SECHE: -350,
  FORCE: 0,
  FORME_GENERALE: 0,
};

/**
 * Mifflin-St Jeor : la formule de référence pour le BMR.
 * Si certaines données manquent, on retombe sur des estimations raisonnables.
 */
export function estimateTDEE(args: {
  poidsKg: number | null;
  tailleCm: number | null;
  age: number | null;
  sexe: Sexe | null;
  niveauActivite: NiveauActivite;
  objectif: Objectif;
}): { bmr: number; tdee: number; cible: number; isEstimation: boolean } {
  const poidsKg = args.poidsKg ?? 75;
  const tailleCm = args.tailleCm ?? 175;
  const age = args.age ?? 25;
  const sexe: Sexe = args.sexe ?? "HOMME";
  const isEstimation =
    args.poidsKg == null ||
    args.tailleCm == null ||
    args.age == null ||
    args.sexe == null;

  // BMR Mifflin-St Jeor
  let bmr = 10 * poidsKg + 6.25 * tailleCm - 5 * age;
  if (sexe === "HOMME") bmr += 5;
  else if (sexe === "FEMME") bmr -= 161;
  else bmr -= 78; // moyenne

  const tdee = Math.round(bmr * ACTIVITE_MULT[args.niveauActivite]);
  const cible = Math.round(tdee + OBJECTIF_KCAL_DELTA[args.objectif]);

  return {
    bmr: Math.round(bmr),
    tdee,
    cible,
    isEstimation,
  };
}

// ----------------------------------------------------------------------------
// Portions
// ----------------------------------------------------------------------------

export const PORTION_GRAMMES: Record<PortionType, number> = {
  CUILLERE_CAFE: 5,
  CUILLERE_SOUPE: 15,
  POIGNEE: 30,
  BOL: 250,
  ASSIETTE: 300,
  GRAMMES: 1,
  UNITE: 100,
};

export function quantiteToGrammes(
  portionType: PortionType,
  quantite: number,
): number {
  return PORTION_GRAMMES[portionType] * quantite;
}

export function macrosFromGrammes(args: {
  grammes: number;
  caloriesP100: number;
  proteinesP100: number;
  glucidesP100: number;
  lipidesP100: number;
}) {
  const factor = args.grammes / 100;
  return {
    calories: args.caloriesP100 * factor,
    proteines: args.proteinesP100 * factor,
    glucides: args.glucidesP100 * factor,
    lipides: args.lipidesP100 * factor,
  };
}

// ----------------------------------------------------------------------------
// Macros recommandées (basées sur poids + objectif)
// ----------------------------------------------------------------------------

export function macrosTarget(args: {
  poidsKg: number | null;
  caloriesCible: number;
  objectif: Objectif;
}) {
  const poids = args.poidsKg ?? 75;
  // Protéines : 1.6 à 2.2 g/kg selon objectif
  const proteinesParKg =
    args.objectif === "SECHE"
      ? 2.2
      : args.objectif === "PRISE_DE_MASSE"
        ? 2.0
        : args.objectif === "FORCE"
          ? 2.0
          : 1.6;
  const proteinesG = Math.round(proteinesParKg * poids);
  // Lipides : 25-30% des calories
  const lipidesG = Math.round((args.caloriesCible * 0.28) / 9);
  // Glucides : le reste
  const kcalProt = proteinesG * 4;
  const kcalLip = lipidesG * 9;
  const glucidesG = Math.max(
    0,
    Math.round((args.caloriesCible - kcalProt - kcalLip) / 4),
  );

  return { proteinesG, lipidesG, glucidesG };
}

// ----------------------------------------------------------------------------
// Daily summary helper
// ----------------------------------------------------------------------------

export async function getDailyNutrition(args: {
  userId: string;
  date: Date;
}) {
  const start = new Date(args.date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const logs = await prisma.nutritionLog.findMany({
    where: {
      userId: args.userId,
      date: { gte: start, lt: end },
    },
    orderBy: [{ repas: "asc" }, { date: "asc" }],
    include: {
      ingredient: { select: { id: true, nom: true, photo: true } },
      recette: { select: { id: true, nom: true, photo: true } },
    },
  });

  const totals = logs.reduce(
    (acc, l) => {
      acc.calories += l.calories;
      acc.proteines += l.proteines;
      acc.glucides += l.glucides;
      acc.lipides += l.lipides;
      return acc;
    },
    { calories: 0, proteines: 0, glucides: 0, lipides: 0 },
  );

  return { logs, totals };
}
