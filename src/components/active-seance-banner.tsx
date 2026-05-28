import Link from "next/link";
import { Flame, Play } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Banner global affiché sur TOUTES les pages quand une séance est en cours.
 * Évite à l'user de "perdre" sa séance s'il ferme l'app ou navigue ailleurs.
 *
 * Le banner ne s'affiche pas :
 * - sur les pages /seance/[id]/live (on y est déjà)
 * - sur /auth/*
 * - si aucune séance EN_COURS
 *
 * Détermination "should hide" via une server check — pas de prop pathname
 * (les server components n'y ont pas accès). On délègue le hide au CSS
 * grâce à des classes conditionnelles selon la route.
 */
export async function ActiveSeanceBanner() {
  const session = await auth();
  if (!session?.user?.id) return null;

  let active;
  try {
    active = await prisma.seance.findFirst({
      where: { userId: session.user.id, statut: "EN_COURS" },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        programme: { select: { nom: true } },
        sets: { where: { validated: true }, select: { id: true } },
      },
    });
  } catch {
    return null;
  }

  if (!active) return null;

  const elapsedMin = Math.max(
    0,
    Math.floor((Date.now() - active.date.getTime()) / 60000),
  );
  const nbSets = active.sets.length;
  const programmeNom = active.programme?.nom ?? "Séance libre";

  return (
    <Link
      href={`/seance/${active.id}/live`}
      // Masqué automatiquement sur la page live (le layout l'enveloppera avec
      // une classe qui le cache via :has() ou via une prop côté layout — voir
      // RootLayout).
      data-active-seance-banner
      className="flex items-center gap-2 bg-accent px-4 py-2 text-white shadow-md shadow-accent/30 transition-transform active:scale-[0.99]"
    >
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-white/20">
        <Flame className="size-3.5 animate-pulse" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium leading-tight">
          Séance en cours · {programmeNom}
        </p>
        <p className="text-[10px] text-white/80 leading-tight">
          {elapsedMin === 0 ? "vient de démarrer" : `${elapsedMin} min écoulées`}
          {nbSets > 0 && ` · ${nbSets} sets validés`}
        </p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-medium">
        <Play className="size-3" />
        Reprendre
      </span>
    </Link>
  );
}
