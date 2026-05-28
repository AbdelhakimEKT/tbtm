import Link from "next/link";
import {
  ArrowLeft,
  Construction,
  Dumbbell,
  Library,
  Zap,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardLabel } from "@/components/ui/card";
import { MUSCLE_LABEL } from "@/lib/labels";

type SearchParams = Promise<{ programme?: string }>;

export default async function NouvelleSeancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const session = await auth();

  // Si on a un programme dans l'URL, on charge son détail pour preview
  const programme = params.programme
    ? await safeGetProgramme(params.programme, session?.user?.id)
    : null;

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href={programme ? `/programmes/${programme.id}` : "/"}
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </header>

      <Card className="flex items-start gap-3 border-warning/40 bg-warning/5">
        <Construction className="size-5 shrink-0 text-warning" />
        <div className="flex-1">
          <p className="text-sm font-medium">Phase 4 en chantier</p>
          <p className="mt-1 text-[11px] text-muted-strong">
            Le mode séance live (timer de récup, validation des sets, suggestion auto de charge, mini-player Spotify) arrive bientôt. En attendant tu peux préparer tes programmes et explorer les exos.
          </p>
        </div>
      </Card>

      {programme && (
        <section className="mt-4">
          <CardLabel className="mb-2 px-1">Aperçu de la séance</CardLabel>
          <Card highlighted>
            <p className="text-sm font-medium">{programme.nom}</p>
            <p className="mt-0.5 text-[10px] text-muted">
              {programme.exercices.length} exercice{programme.exercices.length > 1 ? "s" : ""} prévu{programme.exercices.length > 1 ? "s" : ""}
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {programme.exercices.map((e, i) => (
                <li
                  key={e.id}
                  className="flex items-center gap-2 rounded-lg bg-bg px-2.5 py-2 text-xs"
                >
                  <span className="grid size-5 place-items-center rounded-full bg-accent-bg text-[9px] font-medium text-accent-soft">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.exercice.nom}</p>
                    <p className="text-[10px] text-muted">
                      {e.exercice.muscles.slice(0, 2).map((m) => MUSCLE_LABEL[m]).join(", ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-strong">
                    {e.seriesCibles}×{e.repsCibles}
                    {e.poidsCible != null && ` · ${e.poidsCible}kg`}
                    {e.bwPlusKg != null && ` · BW+${e.bwPlusKg}`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section className="mt-5 space-y-2">
        <CardLabel className="px-1">En attendant tu peux</CardLabel>
        <Link href="/programmes">
          <Card className="flex items-center gap-3 transition-colors hover:border-accent-border">
            <div className="grid size-10 place-items-center rounded-xl bg-accent-bg text-accent-soft">
              <Library className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Gérer mes programmes</p>
              <CardLabel className="mt-0.5 normal-case tracking-normal">
                Créer, dupliquer, définir un programme actif
              </CardLabel>
            </div>
            <span className="text-[10px] text-muted">→</span>
          </Card>
        </Link>

        <Link href="/exercices">
          <Card className="flex items-center gap-3 transition-colors hover:border-accent-border">
            <div className="grid size-10 place-items-center rounded-xl bg-accent-bg text-accent-soft">
              <Dumbbell className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Bibliothèque d&apos;exercices</p>
              <CardLabel className="mt-0.5 normal-case tracking-normal">
                Parcourir, rechercher, créer un exo
              </CardLabel>
            </div>
            <span className="text-[10px] text-muted">→</span>
          </Card>
        </Link>

        <Card className="flex items-center gap-3 opacity-50">
          <div className="grid size-10 place-items-center rounded-xl bg-bar-idle text-muted">
            <Zap className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Lancer une séance live</p>
            <CardLabel className="mt-0.5 normal-case tracking-normal">
              Bientôt — phase 4
            </CardLabel>
          </div>
        </Card>
      </section>
    </div>
  );
}

async function safeGetProgramme(id: string, userId: string | undefined) {
  if (!userId) return null;
  try {
    return await prisma.programme.findFirst({
      where: {
        id,
        OR: [
          { createdById: userId },
          { visibilite: { in: ["AMIS", "COMMUNAUTE"] } },
        ],
      },
      select: {
        id: true,
        nom: true,
        exercices: {
          orderBy: { ordre: "asc" },
          select: {
            id: true,
            seriesCibles: true,
            repsCibles: true,
            poidsCible: true,
            bwPlusKg: true,
            exercice: {
              select: { nom: true, muscles: true },
            },
          },
        },
      },
    });
  } catch {
    return null;
  }
}
