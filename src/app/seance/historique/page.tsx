import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileEdit,
  Plus,
  XCircle,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardLabel } from "@/components/ui/card";

export default async function HistoriqueSeancesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/seance/historique");
  }

  const seances = await prisma.seance.findMany({
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

  // Group par mois (YYYY-MM)
  const groups = new Map<
    string,
    { label: string; seances: typeof seances }
  >();
  for (const s of seances) {
    const key = `${s.date.getFullYear()}-${String(s.date.getMonth() + 1).padStart(2, "0")}`;
    const label = s.date.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
    if (!groups.has(key)) groups.set(key, { label, seances: [] });
    groups.get(key)!.seances.push(s);
  }

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
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([key, group]) => (
            <section key={key}>
              <CardLabel className="mb-2 px-1">{group.label}</CardLabel>
              <Card className="flex flex-col gap-1.5">
                {group.seances.map((s) => (
                  <Link
                    key={s.id}
                    href={`/seance/${s.id}`}
                    className="flex items-center gap-2 rounded-lg bg-bg px-2.5 py-2 transition-colors hover:bg-bg/60"
                  >
                    {s.statut === "ANNULEE" ? (
                      <XCircle className="size-3.5 shrink-0 text-danger" />
                    ) : s.manuelle ? (
                      <FileEdit className="size-3.5 shrink-0 text-muted-strong" />
                    ) : (
                      <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {s.programme?.nom ?? "Séance libre"}
                        {s.manuelle && (
                          <span className="ml-1 text-[9px] font-normal text-muted">
                            (passée)
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted">
                        {s.date.toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                        {s.statut === "TERMINEE" && s._count.sets > 0 && (
                          <>
                            {" · "}
                            {s._count.sets} série{s._count.sets > 1 ? "s" : ""}
                            {s.volumeTotalKg > 0 && (
                              <> · {(s.volumeTotalKg / 1000).toFixed(1)}t</>
                            )}
                          </>
                        )}
                        {s.statut === "ANNULEE" && " · abandonnée"}
                      </p>
                    </div>
                    <ChevronRight className="size-3.5 shrink-0 text-muted" />
                  </Link>
                ))}
              </Card>
            </section>
          ))}
          {seances.length === 200 && (
            <p className="text-center text-[10px] text-muted">
              200 séances affichées (les plus récentes)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
