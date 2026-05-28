import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type ExerciceSeed = Prisma.ExerciceCreateInput;

const EXERCICES: ExerciceSeed[] = [
  // --- Pectoraux ---
  {
    nom: "Développé couché",
    muscles: ["PECTORAUX", "TRICEPS", "EPAULES"],
    materiel: ["BARRE"],
    prise: "PRONATION",
    dynamisme: "CONTROLE",
    tempo: "3-1-1-0",
    guideExecution: [
      "Allonge-toi sur le banc, omoplates serrées, pieds bien ancrés au sol.",
      "Prends la barre en pronation, mains un peu plus larges que les épaules.",
      "Descends la barre en contrôle vers le bas des pectoraux (touche légèrement).",
      "Pousse en explosif, sans verrouiller les coudes en haut.",
    ].join("\n\n"),
  },
  {
    nom: "Développé incliné haltères",
    muscles: ["PECTORAUX", "EPAULES"],
    materiel: ["HALTERES"],
    prise: "NEUTRE",
    dynamisme: "CONTROLE",
    tempo: "3-0-1-0",
    guideExecution:
      "Banc incliné à 30-45°. Coudes légèrement en avant. Descends jusqu'à ce que les haltères soient au niveau des pecs, puis pousse en gardant la tension.",
  },
  {
    nom: "Pompes",
    muscles: ["PECTORAUX", "TRICEPS", "EPAULES"],
    materiel: ["POIDS_DE_CORPS"],
    prise: "PRONATION",
    dynamisme: "CONTROLE",
    isLeste: true,
    tempo: "2-0-1-0",
    guideExecution:
      "Mains un peu plus larges que les épaules, corps gainé en planche. Descends jusqu'à ce que les pecs frôlent le sol, pousse en remontant.",
  },

  // --- Dos ---
  {
    nom: "Tractions",
    muscles: ["DOS", "BICEPS"],
    materiel: ["BARRE_TRACTION"],
    prise: "PRONATION",
    dynamisme: "CONTROLE",
    isLeste: true,
    tempo: "2-0-1-1",
    guideExecution:
      "Suspension bras tendus. Tire en menant le menton au-dessus de la barre, omoplates serrées. Descente contrôlée.",
  },
  {
    nom: "Rowing barre",
    muscles: ["DOS", "BICEPS", "TRAPEZES"],
    materiel: ["BARRE"],
    prise: "PRONATION",
    dynamisme: "CONTROLE",
    tempo: "3-0-1-0",
    guideExecution:
      "Buste penché 45°, dos plat, gainage. Tire la barre vers le bas des côtes en serrant les omoplates. Contrôle la descente.",
  },
  {
    nom: "Tirage poulie haute",
    muscles: ["DOS", "BICEPS"],
    materiel: ["POULIE"],
    prise: "PRONATION",
    dynamisme: "CONTROLE",
    tempo: "2-0-1-1",
    guideExecution:
      "Prise large, légèrement plus large que les épaules. Tire la barre vers le haut des pecs en bombant légèrement le torse.",
  },
  {
    nom: "Soulevé de terre",
    muscles: ["DOS", "ISCHIOS", "FESSIERS", "LOMBAIRES", "TRAPEZES"],
    materiel: ["BARRE"],
    prise: "PRONATION",
    dynamisme: "EXPLOSIF",
    tempo: "1-0-1-0",
    guideExecution: [
      "Pieds largeur bassin, barre au-dessus du milieu du pied.",
      "Hanche basse, dos plat, épaules au-dessus de la barre.",
      "Pousse le sol avec les jambes, puis dégage les hanches.",
      "Descente contrôlée, dos verrouillé.",
    ].join("\n\n"),
  },

  // --- Épaules ---
  {
    nom: "Développé militaire",
    muscles: ["EPAULES", "TRICEPS"],
    materiel: ["BARRE"],
    prise: "PRONATION",
    dynamisme: "CONTROLE",
    tempo: "2-0-1-0",
    guideExecution:
      "Debout ou assis, barre au niveau des clavicules. Pousse au-dessus de la tête sans cambrer excessivement les lombaires.",
  },
  {
    nom: "Élévations latérales",
    muscles: ["EPAULES"],
    materiel: ["HALTERES"],
    prise: "NEUTRE",
    dynamisme: "CONTROLE",
    tempo: "2-1-2-0",
    guideExecution:
      "Coudes légèrement fléchis, monte les haltères jusqu'à hauteur d'épaules. Pas de balancier, descente lente.",
  },

  // --- Bras ---
  {
    nom: "Curl biceps haltères",
    muscles: ["BICEPS"],
    materiel: ["HALTERES"],
    prise: "SUPINATION",
    dynamisme: "CONTROLE",
    tempo: "2-0-1-1",
    guideExecution:
      "Coudes collés au corps. Monte les haltères en supination en serrant le biceps en haut. Descente contrôlée.",
  },
  {
    nom: "Curl marteau",
    muscles: ["BICEPS", "AVANT_BRAS"],
    materiel: ["HALTERES"],
    prise: "NEUTRE",
    dynamisme: "CONTROLE",
    tempo: "2-0-1-0",
    guideExecution:
      "Prise neutre (paumes face à face). Monte sans rotation, contrôle la descente. Cible le brachial et l'avant-bras.",
  },
  {
    nom: "Dips lestés",
    muscles: ["PECTORAUX", "TRICEPS", "EPAULES"],
    materiel: ["BARRE_DIPS"],
    prise: "NEUTRE",
    dynamisme: "CONTROLE",
    isLeste: true,
    tempo: "3-0-1-0",
    guideExecution:
      "Buste légèrement penché en avant pour cibler les pecs. Descends jusqu'à ce que les épaules soient sous les coudes, pousse en explosif.",
  },
  {
    nom: "Extensions triceps poulie",
    muscles: ["TRICEPS"],
    materiel: ["POULIE"],
    prise: "PRONATION",
    dynamisme: "CONTROLE",
    tempo: "2-0-1-1",
    guideExecution:
      "Coudes collés au corps. Étends les bras en serrant les triceps en bas. Remonte lentement.",
  },

  // --- Jambes ---
  {
    nom: "Squat",
    muscles: ["QUADRICEPS", "FESSIERS", "ISCHIOS"],
    materiel: ["BARRE"],
    prise: "PRONATION",
    dynamisme: "CONTROLE",
    tempo: "3-1-1-0",
    guideExecution: [
      "Barre sur les trapèzes (high bar) ou sur les épaules (low bar).",
      "Pieds largeur épaules, pointes légèrement ouvertes.",
      "Descends en gardant le dos droit et la poitrine ouverte jusqu'à ce que les cuisses soient parallèles au sol.",
      "Remonte en poussant fort dans le sol.",
    ].join("\n\n"),
  },
  {
    nom: "Hip thrust",
    muscles: ["FESSIERS", "ISCHIOS"],
    materiel: ["BARRE"],
    dynamisme: "EXPLOSIF",
    tempo: "1-1-1-1",
    guideExecution:
      "Dos appuyé sur un banc, barre sur les hanches (avec coussin). Pousse les hanches vers le haut en contractant les fessiers, pause en haut.",
  },
  {
    nom: "Leg curl",
    muscles: ["ISCHIOS"],
    materiel: ["MACHINE"],
    dynamisme: "CONTROLE",
    tempo: "2-1-1-1",
    guideExecution:
      "Allongé sur la machine, cheville sous le rouleau. Ramène les talons vers les fessiers, contrôle la descente.",
  },
  {
    nom: "Mollets debout",
    muscles: ["MOLLETS"],
    materiel: ["HALTERES"],
    dynamisme: "EXPLOSIF",
    tempo: "1-1-1-1",
    guideExecution:
      "Sur la pointe des pieds, haltères en mains. Monte le plus haut possible, pause d'une seconde en haut, descente complète.",
  },

  // --- Abdos ---
  {
    nom: "Crunchs",
    muscles: ["ABDOS"],
    materiel: ["POIDS_DE_CORPS"],
    dynamisme: "CONTROLE",
    tempo: "1-1-1-0",
    guideExecution:
      "Allongé au sol, genoux fléchis. Décolle uniquement les épaules en contractant les abdos. Ne tire pas sur la nuque.",
  },
  {
    nom: "Planche",
    muscles: ["ABDOS", "LOMBAIRES"],
    materiel: ["POIDS_DE_CORPS"],
    dynamisme: "ISOMETRIQUE",
    tempo: "0-0-0-0",
    guideExecution:
      "Avant-bras au sol, corps droit comme une planche. Gainage abdos + fessiers. Maintiens le plus longtemps possible sans casser la posture.",
  },
  {
    nom: "Relevé de jambes suspendu",
    muscles: ["ABDOS"],
    materiel: ["BARRE_TRACTION"],
    dynamisme: "CONTROLE",
    tempo: "2-0-1-1",
    guideExecution:
      "Suspendu à la barre, monte les jambes tendues ou fléchies jusqu'à parallèle au sol minimum. Descente contrôlée, pas de balancier.",
  },
];

async function main() {
  console.log("🌱 Seed exercices…");

  let inserted = 0;
  let updated = 0;
  for (const exo of EXERCICES) {
    // Les exercices "système" ont createdById = null. On les identifie par leur nom.
    const existing = await prisma.exercice.findFirst({
      where: { nom: exo.nom, createdById: null },
      select: { id: true },
    });
    if (existing) {
      await prisma.exercice.update({ where: { id: existing.id }, data: exo });
      updated++;
    } else {
      await prisma.exercice.create({ data: exo });
      inserted++;
    }
  }
  console.log(`✅ ${inserted} créés, ${updated} mis à jour`);

  console.log("🌱 Seed badges…");
  const BADGES = [
    { slug: "premier-pr", nom: "Premier PR", description: "Bat ton premier PR sur n'importe quel exercice.", icone: "Trophy", rarete: "COMMUN" as const, ordre: 1 },
    { slug: "streak-7", nom: "Streak 7 jours", description: "Entraîne-toi 7 jours dans la même semaine.", icone: "Flame", rarete: "COMMUN" as const, ordre: 10 },
    { slug: "streak-30", nom: "Streak 30 jours", description: "30 jours d'entraînement sur 30 jours glissants.", icone: "Flame", rarete: "RARE" as const, ordre: 11 },
    { slug: "streak-100", nom: "Streak 100 jours", description: "100 jours d'entraînement consécutifs. Monstre.", icone: "Flame", rarete: "EPIQUE" as const, ordre: 12 },
    { slug: "10-seances", nom: "10 séances", description: "Termine 10 séances.", icone: "Dumbbell", rarete: "COMMUN" as const, ordre: 20 },
    { slug: "50-seances", nom: "50 séances", description: "Termine 50 séances.", icone: "Dumbbell", rarete: "RARE" as const, ordre: 21 },
    { slug: "100-seances", nom: "100 séances", description: "Termine 100 séances. T'es bon tu montes.", icone: "Dumbbell", rarete: "EPIQUE" as const, ordre: 22 },
    { slug: "500-seances", nom: "500 séances", description: "Triple monstre.", icone: "Dumbbell", rarete: "LEGENDAIRE" as const, ordre: 23 },
    { slug: "volume-10t", nom: "10 tonnes soulevées", description: "Volume cumulé : 10 tonnes.", icone: "Weight", rarete: "COMMUN" as const, ordre: 30 },
    { slug: "volume-50t", nom: "50 tonnes soulevées", description: "Volume cumulé : 50 tonnes.", icone: "Weight", rarete: "RARE" as const, ordre: 31 },
    { slug: "volume-100t", nom: "100 tonnes soulevées", description: "Volume cumulé : 100 tonnes.", icone: "Weight", rarete: "EPIQUE" as const, ordre: 32 },
    { slug: "volume-1000t", nom: "1000 tonnes soulevées", description: "Volume cumulé : 1000 tonnes. Légendaire.", icone: "Weight", rarete: "LEGENDAIRE" as const, ordre: 33 },
    { slug: "premier-defi", nom: "Premier défi lancé", description: "Lance ton premier défi à un pote.", icone: "Zap", rarete: "COMMUN" as const, ordre: 40 },
    { slug: "premier-defi-gagne", nom: "Premier défi gagné", description: "Bats un pote sur volume dans un défi.", icone: "Crown", rarete: "RARE" as const, ordre: 41 },
    { slug: "premiere-recette", nom: "Première recette", description: "Publie ta première recette.", icone: "ChefHat", rarete: "COMMUN" as const, ordre: 50 },
    { slug: "niveau-5", nom: "Niveau 5", description: "Atteins le niveau 5.", icone: "Star", rarete: "COMMUN" as const, ordre: 60 },
    { slug: "niveau-10", nom: "Niveau 10", description: "Atteins le niveau 10.", icone: "Star", rarete: "RARE" as const, ordre: 61 },
    { slug: "niveau-20", nom: "Niveau 20", description: "Atteins le niveau 20. T'es bon tu montes.", icone: "Star", rarete: "EPIQUE" as const, ordre: 62 },
    { slug: "mystere", nom: "???", description: "???", icone: "HelpCircle", rarete: "MYSTERE" as const, isSecret: true, ordre: 999 },
  ];
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { slug: badge.slug },
      update: badge,
      create: badge,
    });
  }
  console.log(`✅ ${BADGES.length} badges upsertés`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
