import Link from "next/link";
import { Clock, Globe, Lock, Plus, Users } from "lucide-react";
import type { Prisma, Visibilite } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { CATEGORIE_RECETTE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";

const TABS = [
  { key: "mes", label: "Mes recettes" },
  { key: "communaute", label: "Communauté" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type SearchParams = Promise<{ tab?: string }>;

const VISIBILITE_ICON: Record<Visibilite, React.ComponentType<{ className?: string }>> = {
  PRIVE: Lock,
  AMIS: Users,
  COMMUNAUTE: Globe,
};

export default async function RecettesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;
  const tab: TabKey = TABS.find((t) => t.key === params.tab)?.key ?? "mes";

  if (!session?.user?.id) {
    return (
      <div className="px-4 pt-5 pb-8">
        <h1 className="text-lg font-semibold">Recettes</h1>
        <Link
          href="/auth/login?callbackUrl=/recettes"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white"
        >
          Me connecter
        </Link>
      </div>
    );
  }

  let where: Prisma.RecetteWhereInput;
  if (tab === "mes") {
    where = { createdById: session.user.id };
  } else {
    where = { visibilite: "COMMUNAUTE", createdById: { not: session.user.id } };
  }

  const recettes = await prisma.recette.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      nom: true,
      description: true,
      photo: true,
      portions: true,
      tempsPrepMin: true,
      categorie: true,
      visibilite: true,
      noteMoyenne: true,
      nbVotes: true,
      createdBy: { select: { pseudo: true } },
      _count: { select: { ingredients: true } },
    },
    take: 50,
  });

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Recettes</h1>
          <p className="mt-0.5 text-[11px] text-muted">
            {recettes.length} recette{recettes.length > 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/recettes/nouveau"
          className="inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white"
        >
          <Plus className="size-4" /> Nouvelle
        </Link>
      </header>

      <div className="flex gap-1 rounded-lg border border-card-border bg-card p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/recettes?tab=${t.key}`}
            scroll={false}
            className={cn(
              "flex-1 rounded-md py-1.5 text-center text-[11px] font-medium transition-colors",
              tab === t.key
                ? "bg-accent text-white shadow-sm shadow-accent/30"
                : "text-muted-strong hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {recettes.length === 0 ? (
        <Card className="mt-4 py-8 text-center">
          <p className="text-sm">
            {tab === "mes" ? "Pas encore de recette" : "Personne n'a partagé"}
          </p>
          <p className="mt-1 text-[11px] text-muted-strong">
            {tab === "mes" && (
              <Link
                href="/recettes/nouveau"
                className="text-accent-soft underline-offset-2 hover:underline"
              >
                Crée ta première recette
              </Link>
            )}
          </p>
        </Card>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {recettes.map((r) => {
            const VisibIcon = VISIBILITE_ICON[r.visibilite];
            return (
              <li key={r.id}>
                <Link href={`/recettes/${r.id}`}>
                  <Card className="flex gap-3 transition-colors hover:border-accent-border">
                    {r.photo ? (
                      <img
                        src={r.photo}
                        alt=""
                        className="size-16 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="grid size-16 shrink-0 place-items-center rounded-md bg-accent-bg">
                        <span className="text-lg">🍽️</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-medium">{r.nom}</p>
                        <VisibIcon className="size-3 shrink-0 text-muted" />
                      </div>
                      {r.description && (
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-strong">
                          {r.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted">
                        <span className="rounded-full bg-accent-bg px-2 py-0.5 text-accent-soft">
                          {CATEGORIE_RECETTE_LABEL[r.categorie]}
                        </span>
                        <span>{r._count.ingredients} ingrédients</span>
                        {r.tempsPrepMin && (
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="size-2.5" />
                            {r.tempsPrepMin}min
                          </span>
                        )}
                        {tab !== "mes" && (
                          <span>par {r.createdBy.pseudo}</span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

