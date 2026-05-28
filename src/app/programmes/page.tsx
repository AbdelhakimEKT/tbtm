import Link from "next/link";
import { Plus, Users2 } from "lucide-react";
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

import { ProgrammeCard, type ProgrammeListItem } from "./_card";

const TABS = [
  { key: "mes", label: "Mes créations" },
  { key: "communaute", label: "Communauté" },
  { key: "partages", label: "Partagés" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type SearchParams = Promise<{ tab?: string }>;

export default async function ProgrammesPage({
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
        <h1 className="text-lg font-semibold">Programmes</h1>
        <p className="mt-1 text-xs text-muted-strong">
          Connecte-toi pour créer ou parcourir des programmes.
        </p>
        <Link
          href="/auth/login?callbackUrl=/programmes"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white"
        >
          Me connecter
        </Link>
      </div>
    );
  }

  let programmes: ProgrammeListItem[] = [];
  let dbError = false;
  try {
    programmes = await fetchProgrammes(session.user.id, tab);
  } catch {
    dbError = true;
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Programmes</h1>
          <p className="mt-0.5 text-[11px] text-muted">
            {dbError
              ? "BDD non connectée"
              : `${programmes.length} programme${programmes.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/programmes/nouveau"
          className="inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white shadow-sm shadow-accent/30"
        >
          <Plus className="size-4" /> Nouveau
        </Link>
      </header>

      {/* Onglets */}
      <div className="flex gap-1 rounded-lg border border-card-border bg-card p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/programmes?tab=${t.key}`}
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

      <section className="mt-4 flex flex-col gap-2">
        {dbError && (
          <Card className="border-danger/30 bg-danger/5 text-xs text-danger">
            Impossible de charger les programmes. Vérifie la connexion BDD.
          </Card>
        )}
        {!dbError && programmes.length === 0 && (
          <EmptyState tab={tab} />
        )}
        {programmes.map((p) => (
          <ProgrammeCard key={p.id} programme={p} currentUserId={session.user.id} />
        ))}
      </section>
    </div>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  if (tab === "mes") {
    return (
      <Card className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="text-sm">T&apos;as encore zéro programme</p>
        <p className="text-[11px] text-muted-strong">
          Crée le premier — Push/Pull/Legs, Full body, ce que tu veux.
        </p>
        <Link
          href="/programmes/nouveau"
          className="mt-2 inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white"
        >
          <Plus className="size-4" /> Créer un programme
        </Link>
      </Card>
    );
  }
  if (tab === "communaute") {
    return (
      <Card className="flex flex-col items-center gap-2 py-8 text-center">
        <Users2 className="size-6 text-muted" />
        <p className="text-sm">Personne n&apos;a encore partagé de programme</p>
        <p className="text-[11px] text-muted-strong">
          Quand d&apos;autres users mettront leurs programmes en mode Communauté,
          tu les verras ici. Tu peux les dupliquer en un clic.
        </p>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col items-center gap-2 py-8 text-center">
      <Users2 className="size-6 text-muted" />
      <p className="text-sm">Pas de programme partagé avec toi</p>
      <p className="text-[11px] text-muted-strong">
        Ça arrive quand un pote met un programme en mode Amis (phase 9).
      </p>
    </Card>
  );
}

async function fetchProgrammes(
  userId: string,
  tab: TabKey,
): Promise<ProgrammeListItem[]> {
  let where: Prisma.ProgrammeWhereInput;

  if (tab === "mes") {
    where = { createdById: userId };
  } else if (tab === "communaute") {
    where = { visibilite: "COMMUNAUTE", createdById: { not: userId } };
  } else {
    // Partagés avec moi : programmes AMIS par mes amis (Phase 9)
    // Pour l'instant on retourne juste un set vide
    where = { id: "__none__" };
  }

  return prisma.programme.findMany({
    where,
    orderBy: [{ estProgrammeActif: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      nom: true,
      description: true,
      tags: true,
      visibilite: true,
      estProgrammeActif: true,
      frequenceHebdo: true,
      updatedAt: true,
      createdById: true,
      createdBy: { select: { pseudo: true } },
      _count: { select: { exercices: true } },
    },
    take: 50,
  });
}

