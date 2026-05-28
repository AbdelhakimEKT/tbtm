import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

import { NouveauDefiClient } from "./_client";

type SearchParams = Promise<{ programme?: string; ami?: string }>;

export default async function NouveauDefiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/defis/nouveau");

  const params = await searchParams;

  // Mes programmes (avec exercices, sinon impossible de défier)
  const programmes = await prisma.programme.findMany({
    where: {
      createdById: session.user.id,
      exercices: { some: {} },
    },
    orderBy: [
      { estProgrammeActif: "desc" },
      { updatedAt: "desc" },
    ],
    select: {
      id: true,
      nom: true,
      _count: { select: { exercices: true } },
    },
  });

  // Mes amis acceptés
  const amities = await prisma.amitie.findMany({
    where: {
      statut: "ACCEPTEE",
      OR: [
        { deId: session.user.id },
        { aId: session.user.id },
      ],
    },
    select: {
      deId: true,
      aId: true,
      de: {
        select: { id: true, pseudo: true, avatar: true, niveau: true },
      },
      a: {
        select: { id: true, pseudo: true, avatar: true, niveau: true },
      },
    },
  });
  const amis = amities
    .map((am) => (am.deId === session.user.id ? am.a : am.de))
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo));

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/defis"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </header>

      <h1 className="text-2xl font-semibold">Lancer un défi</h1>
      <p className="mt-1 text-xs text-muted-strong">
        Pick un de tes programmes, sélectionne tes potes, balance-leur un ping.
      </p>

      <div className="mt-5">
        {programmes.length === 0 ? (
          <Card className="py-8 text-center">
            <p className="text-sm">Aucun programme prêt</p>
            <p className="mt-1 text-[11px] text-muted-strong">
              Crée d&apos;abord un programme avec au moins un exercice.
            </p>
            <Link
              href="/programmes/nouveau"
              className="mt-3 inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white"
            >
              Créer un programme
            </Link>
          </Card>
        ) : amis.length === 0 ? (
          <Card className="py-8 text-center">
            <p className="text-sm">Aucun pote à défier</p>
            <p className="mt-1 text-[11px] text-muted-strong">
              Ajoute des potes d&apos;abord pour pouvoir les défier.
            </p>
            <Link
              href="/amis"
              className="mt-3 inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-white"
            >
              Aller à mes potes
            </Link>
          </Card>
        ) : (
          <NouveauDefiClient
            programmes={programmes}
            amis={amis}
            defaultProgrammeId={params.programme}
            defaultAmiId={params.ami}
          />
        )}
      </div>
    </div>
  );
}
