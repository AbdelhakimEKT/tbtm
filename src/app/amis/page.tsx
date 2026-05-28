import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AmisClient } from "./_client";

type SearchParams = Promise<{ tab?: string }>;

export default async function AmisPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/amis");
  }
  const params = await searchParams;
  const initialTab = (
    ["amis", "recues", "envoyees"].includes(params.tab ?? "")
      ? params.tab
      : "amis"
  ) as "amis" | "recues" | "envoyees";

  // Demandes reçues (en attente, je suis le destinataire)
  const recues = await prisma.amitie.findMany({
    where: { aId: session.user.id, statut: "EN_ATTENTE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      de: {
        select: {
          id: true,
          pseudo: true,
          avatar: true,
          categorie: true,
          niveau: true,
        },
      },
    },
  });

  // Demandes envoyées (en attente, je suis l'émetteur)
  const envoyees = await prisma.amitie.findMany({
    where: { deId: session.user.id, statut: "EN_ATTENTE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      a: {
        select: {
          id: true,
          pseudo: true,
          avatar: true,
          categorie: true,
          niveau: true,
        },
      },
    },
  });

  // Mes amis (acceptées, peu importe le sens)
  const amitiesAcceptees = await prisma.amitie.findMany({
    where: {
      statut: "ACCEPTEE",
      OR: [
        { deId: session.user.id },
        { aId: session.user.id },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      deId: true,
      aId: true,
      de: {
        select: {
          id: true,
          pseudo: true,
          avatar: true,
          categorie: true,
          niveau: true,
        },
      },
      a: {
        select: {
          id: true,
          pseudo: true,
          avatar: true,
          categorie: true,
          niveau: true,
        },
      },
    },
  });

  // Normalise : pour chaque amitié, retourne "l'autre user" (pas moi)
  const amis = amitiesAcceptees.map((am) => {
    const other = am.deId === session.user.id ? am.a : am.de;
    return { amitieId: am.id, ...other };
  });

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
      </header>

      <h1 className="text-2xl font-semibold">Mes potes</h1>
      <p className="mt-1 text-xs text-muted-strong">
        Ajoute tes potes pour les défier et leur chambrer dessus.
      </p>

      <div className="mt-5">
        <AmisClient
          initialTab={initialTab}
          amis={amis}
          recues={recues}
          envoyees={envoyees}
        />
      </div>
    </div>
  );
}
