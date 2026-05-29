import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { ManualSeanceForm, type ExerciceOption } from "./_client";

export default async function ManuelleSeancePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/seance/manuelle");
  }

  const exos = await prisma.exercice.findMany({
    where: {
      OR: [
        { createdById: null }, // exos de base (seed)
        { createdById: session.user.id },
      ],
    },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true, isLeste: true, muscles: true },
  });

  const options: ExerciceOption[] = exos.map((e) => ({
    id: e.id,
    nom: e.nom,
    isLeste: e.isLeste,
    muscles: e.muscles,
  }));

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/seance/nouvelle"
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </header>

      <section className="mb-4">
        <h1 className="text-xl font-semibold">Séance passée</h1>
        <p className="mt-1 text-[11px] text-muted-strong">
          Pour backfiller ton historique. Pas d&apos;XP, pas de streak, pas de PR
          enregistré — c&apos;est juste de la donnée.
        </p>
      </section>

      <ManualSeanceForm exercices={options} />
    </div>
  );
}
