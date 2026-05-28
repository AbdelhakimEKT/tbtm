import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Zap } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

import { DefiTabs } from "./_tabs";

type SearchParams = Promise<{ tab?: string }>;

export default async function DefisPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/defis");
  }
  const params = await searchParams;
  const initialTab = (
    ["recus", "en-cours", "termines"].includes(params.tab ?? "")
      ? params.tab
      : "recus"
  ) as "recus" | "en-cours" | "termines";

  // Tous les défis où je suis participant, avec infos défi + autres participants
  const participations = await prisma.defiParticipant.findMany({
    where: { userId: session.user.id },
    orderBy: { defi: { createdAt: "desc" } },
    select: {
      id: true,
      statut: true,
      defi: {
        select: {
          id: true,
          titre: true,
          message: true,
          statut: true,
          createdAt: true,
          lanceParId: true,
          lancePar: { select: { pseudo: true, avatar: true } },
          programme: { select: { id: true, nom: true } },
          participants: {
            select: {
              id: true,
              statut: true,
              userId: true,
              user: { select: { pseudo: true, avatar: true } },
            },
          },
        },
      },
    },
  });

  type DefiItem = (typeof participations)[number];

  // Catégorise
  const recus: DefiItem[] = [];
  const enCours: DefiItem[] = [];
  const termines: DefiItem[] = [];
  for (const p of participations) {
    if (p.defi.statut === "TERMINE" || p.statut === "COMPLETE") {
      termines.push(p);
    } else if (p.statut === "EN_ATTENTE") {
      recus.push(p);
    } else if (
      p.defi.statut === "EN_COURS" &&
      (p.statut === "ACCEPTE")
    ) {
      enCours.push(p);
    } else if (p.statut === "REFUSE") {
      // si j'ai refusé, je les laisse dans terminés pour archivage
      termines.push(p);
    } else {
      enCours.push(p);
    }
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/profil"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <Link
          href="/defis/nouveau"
          className="inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white shadow-sm shadow-accent/30"
        >
          <Plus className="size-4" /> Lancer
        </Link>
      </header>

      <h1 className="text-2xl font-semibold">Défis</h1>
      <p className="mt-1 text-xs text-muted-strong">
        Défie tes potes sur un de tes programmes. Pas de gagnant officiel — juste
        les chiffres et le chambrage.
      </p>

      <div className="mt-5">
        <DefiTabs
          initialTab={initialTab}
          recus={recus}
          enCours={enCours}
          termines={termines}
          meId={session.user.id}
        />
      </div>

      {participations.length === 0 && (
        <Card className="mt-5 flex flex-col items-center gap-2 py-8 text-center">
          <Zap className="size-7 text-muted" />
          <p className="text-sm">Aucun défi pour l&apos;instant</p>
          <p className="text-[11px] text-muted-strong">
            Lance ton premier défi en cliquant sur le bouton « Lancer » en haut.
          </p>
          <Link
            href="/defis/nouveau"
            className="mt-2 inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white"
          >
            <Plus className="size-4" /> Lancer mon premier défi
          </Link>
        </Card>
      )}
    </div>
  );
}

// On exporte le type pour le composant client
export type DefiPageItem = {
  id: string;
  statut: "EN_ATTENTE" | "ACCEPTE" | "REFUSE" | "COMPLETE";
  defi: {
    id: string;
    titre: string | null;
    message: string | null;
    statut: "OUVERT" | "EN_COURS" | "TERMINE" | "ANNULE";
    createdAt: Date;
    lanceParId: string;
    lancePar: { pseudo: string; avatar: string | null };
    programme: { id: string; nom: string };
    participants: {
      id: string;
      statut: "EN_ATTENTE" | "ACCEPTE" | "REFUSE" | "COMPLETE";
      userId: string;
      user: { pseudo: string; avatar: string | null };
    }[];
  };
};

