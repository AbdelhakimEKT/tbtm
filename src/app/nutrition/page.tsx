import Link from "next/link";
import type { Repas } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import {
  estimateTDEE,
  getDailyNutrition,
  macrosTarget,
} from "@/lib/nutrition";

import { CalorieRing, MacroBar } from "./_calorie-ring";
import { DateNav } from "./_date-nav";
import { MealSection, type LogItem } from "./_meal-section";

const REPAS_ORDER: Repas[] = [
  "PETIT_DEJEUNER",
  "DEJEUNER",
  "DINER",
  "COLLATION",
];

type SearchParams = Promise<{ date?: string }>;

export default async function NutritionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;

  if (!session?.user?.id) {
    return (
      <div className="px-4 pt-5 pb-8">
        <h1 className="text-lg font-semibold">Nutrition</h1>
        <p className="mt-1 text-xs text-muted-strong">
          Connecte-toi pour suivre tes apports.
        </p>
        <Link
          href="/auth/login?callbackUrl=/nutrition"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white"
        >
          Me connecter
        </Link>
      </div>
    );
  }

  const date = parseDate(params.date);
  const dateIso = toLocalIsoDate(date);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      poidsKg: true,
      tailleCm: true,
      age: true,
      sexe: true,
      niveauActivite: true,
      objectif: true,
    },
  });

  const tdee = estimateTDEE({
    poidsKg: user?.poidsKg ?? null,
    tailleCm: user?.tailleCm ?? null,
    age: user?.age ?? null,
    sexe: user?.sexe ?? null,
    niveauActivite: user?.niveauActivite ?? "MODERE",
    objectif: user?.objectif ?? "FORME_GENERALE",
  });

  const cibleMacros = macrosTarget({
    poidsKg: user?.poidsKg ?? null,
    caloriesCible: tdee.cible,
    objectif: user?.objectif ?? "FORME_GENERALE",
  });

  const daily = await getDailyNutrition({
    userId: session.user.id,
    date,
  });

  // Groupe par repas
  const byRepas = new Map<Repas, LogItem[]>();
  for (const r of REPAS_ORDER) byRepas.set(r, []);
  for (const l of daily.logs) {
    byRepas.get(l.repas)!.push({
      id: l.id,
      portionType: l.portionType,
      quantite: l.quantite,
      calories: l.calories,
      proteines: l.proteines,
      glucides: l.glucides,
      lipides: l.lipides,
      ingredient: l.ingredient,
      recette: l.recette,
    });
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-3">
        <h1 className="text-lg font-semibold">Nutrition</h1>
      </header>

      <DateNav currentDate={dateIso} />

      <section className="mt-4 flex flex-col items-center">
        <CalorieRing
          consommees={daily.totals.calories}
          cible={tdee.cible}
        />
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2">
        <MacroBar
          label="Prot"
          consommees={daily.totals.proteines}
          cible={cibleMacros.proteinesG}
          color="var(--color-accent)"
        />
        <MacroBar
          label="Gluc"
          consommees={daily.totals.glucides}
          cible={cibleMacros.glucidesG}
          color="var(--color-bar-3)"
        />
        <MacroBar
          label="Lip"
          consommees={daily.totals.lipides}
          cible={cibleMacros.lipidesG}
          color="var(--color-warning)"
        />
      </section>

      {tdee.isEstimation && (
        <Card className="mt-3 border-warning/30 bg-warning/5 text-[11px] text-warning">
          Ton TDEE est estimé sur des valeurs par défaut. Pour des chiffres
          précis,{" "}
          <Link href="/profil/edit" className="underline">
            complète ton profil
          </Link>{" "}
          (poids, taille, âge, sexe).
        </Card>
      )}

      {REPAS_ORDER.map((r) => (
        <MealSection
          key={r}
          repas={r}
          date={dateIso}
          items={byRepas.get(r) ?? []}
        />
      ))}

      <div className="mt-6 text-center">
        <Link
          href="/recettes"
          className="text-[11px] text-muted-strong underline-offset-2 hover:text-fg hover:underline"
        >
          Voir mes recettes →
        </Link>
      </div>
    </div>
  );
}

function parseDate(s: string | undefined): Date {
  if (s) {
    const [y, m, d] = s.split("-").map(Number);
    if (y && m && d) {
      const date = new Date(y, m - 1, d);
      if (!isNaN(date.getTime())) return date;
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Format YYYY-MM-DD en LOCAL (pas UTC) pour éviter les shifts de fuseau
 * horaire (ex: Europe/Paris CEST = UTC+2 → toISOString() recule d'1 jour).
 */
function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
