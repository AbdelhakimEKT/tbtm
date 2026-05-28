// Formules de 1RM estimé (Reps Maximum 1)

export type RMFormula = "EPLEY" | "BRZYCKI" | "LOMBARDI";

export function estimate1RM(
  poidsKg: number,
  reps: number,
  formula: RMFormula = "EPLEY",
): number {
  if (reps <= 0 || poidsKg <= 0) return 0;
  if (reps === 1) return poidsKg;

  switch (formula) {
    case "EPLEY":
      // 1RM = poids × (1 + reps / 30)
      return poidsKg * (1 + reps / 30);
    case "BRZYCKI":
      // 1RM = poids × 36 / (37 - reps)  (valide jusqu'à ~10 reps)
      return poidsKg * (36 / (37 - Math.min(reps, 36)));
    case "LOMBARDI":
      // 1RM = poids × reps^0.10
      return poidsKg * Math.pow(reps, 0.1);
  }
}

// Charge cible selon objectif (% du 1RM)
export const CHARGE_TARGET = {
  FORCE: { min: 0.85, max: 1.0, label: "Force" },
  HYPERTROPHIE: { min: 0.65, max: 0.8, label: "Hypertrophie" },
  ENDURANCE: { min: 0.5, max: 0.65, label: "Endurance" },
} as const;
