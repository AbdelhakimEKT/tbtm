import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

import { HistoriqueListe, type SeanceHistoriqueItem } from "./_client";

export default async function HistoriqueSeancesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/seance/historique");
  }

  const rows = await prisma.seance.findMany({
    where: {
      userId: session.user.id,
      statut: { in: ["TERMINEE", "ANNULEE"] },
    },
    orderBy: { date: "desc" },
    take: 200,
    select: {
      id: true,
      date: true,
      statut: true,
      manuelle: true,
      volumeTotalKg: true,
      programme: { select: { nom: true } },
      _count: { select: { sets: { where: { validated: true } } } },
    },
  });

  const seances: SeanceHistoriqueItem[] = rows.map((s) => ({
    id: s.id,
    dateISO: s.date.toISOString(),
    statut: s.statut,
    manuelle: s.manuelle,
    volumeKg: s.volumeTotalKg,
    nbSets: s._count.sets,
    programmeNom: s.programme?.nom ?? null,
  }));

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <Link
          href="/seance/manuelle"
          className="inline-flex items-center gap-1 rounded-full bg-accent-bg px-3 py-1.5 text-[11px] font-medium text-accent-soft hover:bg-accent-bg/70"
        >
          <Plus className="size-3.5" /> Séance passée
        </Link>
      </header>

      <section className="mb-4">
        <h1 className="text-2xl font-semibold">Mes séances</h1>
        <p className="mt-1 text-xs text-muted-strong">
          {seances.length} séance{seances.length > 1 ? "s" : ""} loggée
          {seances.length > 1 ? "s" : ""}
        </p>
      </section>

      {seances.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm">Aucune séance pour l&apos;instant.</p>
          <Link
            href="/seance/manuelle"
            className="inline-flex h-9 items-center gap-1 rounded-full bg-accent px-4 text-xs font-medium text-white"
          >
            <Plus className="size-3.5" /> Ajouter ma première séance
          </Link>
        </Card>
      ) : (
        <HistoriqueListe seances={seances} />
      )}

      {seances.length === 200 && (
        <p className="mt-4 text-center text-[10px] text-muted">
          200 séances affichées (les plus récentes)
        </p>
      )}
    </div>
  );
}
