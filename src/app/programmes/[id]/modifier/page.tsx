import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProgrammeForm } from "../../_form";

type Params = Promise<{ id: string }>;

export default async function EditProgrammePage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/programmes/${id}/modifier`);
  }

  const prog = await prisma.programme.findUnique({
    where: { id },
    select: {
      id: true,
      nom: true,
      description: true,
      tags: true,
      visibilite: true,
      frequenceHebdo: true,
      createdById: true,
    },
  });

  if (!prog) notFound();
  const isOwner = prog.createdById === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    redirect(`/programmes/${id}`);
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href={`/programmes/${id}`}
          aria-label="Retour"
          className="grid size-9 place-items-center rounded-full border border-card-border text-muted-strong hover:text-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </header>

      <h1 className="text-2xl font-semibold">Modifier</h1>
      <p className="mt-1 text-xs text-muted-strong">{prog.nom}</p>

      <div className="mt-6">
        <ProgrammeForm
          mode="edit"
          initial={{
            id: prog.id,
            nom: prog.nom,
            description: prog.description,
            tags: prog.tags,
            visibilite: prog.visibilite,
            frequenceHebdo: prog.frequenceHebdo,
          }}
        />
      </div>
    </div>
  );
}
