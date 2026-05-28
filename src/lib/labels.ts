import type {
  Muscle,
  Materiel,
  Prise,
  Dynamisme,
  Objectif,
  CategorieForce,
  Visibilite,
  Repas,
  PortionType,
  CategorieRecette,
  BadgeRarete,
  StatutDefi,
  StatutDefiParticipant,
} from "@prisma/client";

export const MUSCLE_LABEL: Record<Muscle, string> = {
  PECTORAUX: "Pectoraux",
  DOS: "Dos",
  EPAULES: "Épaules",
  BICEPS: "Biceps",
  TRICEPS: "Triceps",
  AVANT_BRAS: "Avant-bras",
  ABDOS: "Abdos",
  LOMBAIRES: "Lombaires",
  QUADRICEPS: "Quadriceps",
  ISCHIOS: "Ischios",
  FESSIERS: "Fessiers",
  MOLLETS: "Mollets",
  TRAPEZES: "Trapèzes",
};

export const MUSCLE_GROUP_ORDER: Muscle[] = [
  "PECTORAUX",
  "DOS",
  "EPAULES",
  "BICEPS",
  "TRICEPS",
  "AVANT_BRAS",
  "ABDOS",
  "LOMBAIRES",
  "QUADRICEPS",
  "ISCHIOS",
  "FESSIERS",
  "MOLLETS",
  "TRAPEZES",
];

export const MATERIEL_LABEL: Record<Materiel, string> = {
  POIDS_DE_CORPS: "Poids de corps",
  HALTERES: "Haltères",
  BARRE: "Barre",
  BARRE_TRACTION: "Barre de traction",
  BARRE_DIPS: "Barre de dips",
  ELASTIQUE: "Élastique",
  LEST: "Lest",
  POULIE: "Poulie",
  MACHINE: "Machine",
  KETTLEBELL: "Kettlebell",
};

export const PRISE_LABEL: Record<Prise, string> = {
  PRONATION: "Pronation",
  SUPINATION: "Supination",
  NEUTRE: "Neutre",
  PRISE_LARGE: "Prise large",
  PRISE_SERREE: "Prise serrée",
  PRISE_MIXTE: "Prise mixte",
};

export const DYNAMISME_LABEL: Record<Dynamisme, string> = {
  EXPLOSIF: "Explosif",
  CONTROLE: "Contrôlé",
  ISOMETRIQUE: "Isométrique",
};

export const OBJECTIF_LABEL: Record<Objectif, string> = {
  PRISE_DE_MASSE: "Prise de masse",
  SECHE: "Sèche",
  FORCE: "Force",
  FORME_GENERALE: "Forme générale",
};

export const CATEGORIE_FORCE_LABEL: Record<CategorieForce, string> = {
  NOVICE: "Novice",
  DEBUTANT: "Débutant",
  INTERMEDIAIRE: "Intermédiaire",
  AVANCE: "Avancé",
  EXPERT: "Expert",
};

export const VISIBILITE_LABEL: Record<Visibilite, string> = {
  PRIVE: "Privé",
  AMIS: "Amis",
  COMMUNAUTE: "Communauté",
};

export const REPAS_LABEL: Record<Repas, string> = {
  PETIT_DEJEUNER: "Petit-déjeuner",
  DEJEUNER: "Déjeuner",
  DINER: "Dîner",
  COLLATION: "Collation",
};

export const PORTION_LABEL: Record<PortionType, string> = {
  CUILLERE_CAFE: "Cuillère à café",
  CUILLERE_SOUPE: "Cuillère à soupe",
  POIGNEE: "Poignée",
  BOL: "Bol",
  ASSIETTE: "Assiette",
  GRAMMES: "Grammes",
  UNITE: "Unité",
};

export const PORTION_GRAMMES_EQ: Record<PortionType, number> = {
  CUILLERE_CAFE: 5,
  CUILLERE_SOUPE: 15,
  POIGNEE: 30,
  BOL: 250,
  ASSIETTE: 300,
  GRAMMES: 1,
  UNITE: 100,
};

export const CATEGORIE_RECETTE_LABEL: Record<CategorieRecette, string> = {
  PETIT_DEJEUNER: "Petit-déjeuner",
  PLAT: "Plat",
  COLLATION: "Collation",
  DESSERT: "Dessert",
  BOISSON: "Boisson",
  SAUCE: "Sauce",
};

export const BADGE_RARETE_LABEL: Record<BadgeRarete, string> = {
  COMMUN: "Commun",
  RARE: "Rare",
  EPIQUE: "Épique",
  LEGENDAIRE: "Légendaire",
  MYSTERE: "???",
};

export const BADGE_RARETE_COLOR: Record<BadgeRarete, string> = {
  COMMUN: "var(--color-muted)",
  RARE: "#5dcaa5",
  EPIQUE: "#a78bfa",
  LEGENDAIRE: "#ef9f27",
  MYSTERE: "#ef4444",
};

export const STATUT_DEFI_LABEL: Record<StatutDefi, string> = {
  OUVERT: "Ouvert",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
  ANNULE: "Annulé",
};

export const STATUT_DEFI_PARTICIPANT_LABEL: Record<
  StatutDefiParticipant,
  string
> = {
  EN_ATTENTE: "En attente",
  ACCEPTE: "Accepté",
  REFUSE: "Refusé",
  COMPLETE: "Complété",
};
