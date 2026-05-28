import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Globe, Lock, Users } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardLabel } from "@/components/ui/card";
import { VISIBILITE_LABEL } from "@/lib/labels";

import { ShareControls } from "./_share-controls";

type Params = Promise<{ id: string }>;

export default async function PartagerPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/programmes/${id}/partager`);
  }

  const prog = await prisma.programme.findUnique({
    where: { id },
    select: {
      id: true,
      nom: true,
      visibilite: true,
      createdById: true,
    },
  });
  if (!prog) notFound();
  if (prog.createdById !== session.user.id) {
    redirect(`/programmes/${id}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shareUrl = `${appUrl}/programmes/${id}`;

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

      <h1 className="text-2xl font-semibold">Partager</h1>
      <p className="mt-1 text-xs text-muted-strong">{prog.nom}</p>

      <Card highlighted className="mt-5">
        <CardLabel>Statut actuel</CardLabel>
        <div className="mt-2 flex items-center gap-2">
          {prog.visibilite === "PRIVE" && <Lock className="size-4 text-accent-soft" />}
          {prog.visibilite === "AMIS" && <Users className="size-4 text-accent-soft" />}
          {prog.visibilite === "COMMUNAUTE" && (
            <Globe className="size-4 text-accent-soft" />
          )}
          <p className="text-sm font-medium">{VISIBILITE_LABEL[prog.visibilite]}</p>
        </div>
        {prog.visibilite === "PRIVE" && (
          <p className="mt-2 text-[11px] text-muted-strong">
            Personne d&apos;autre que toi ne peut voir ce programme. Change la
            visibilité pour pouvoir le partager.{" "}
            <Link
              href={`/programmes/${id}/modifier`}
              className="text-accent-soft hover:underline"
            >
              Modifier
            </Link>
          </p>
        )}
        {prog.visibilite === "AMIS" && (
          <p className="mt-2 text-[11px] text-muted-strong">
            Visible par tes amis. Le système d&apos;amis arrive en phase 9.
          </p>
        )}
        {prog.visibilite === "COMMUNAUTE" && (
          <p className="mt-2 text-[11px] text-muted-strong">
            Visible par tous les users TBTM. Le lien direct ci-dessous fonctionne
            pour n&apos;importe qui (loggué).
          </p>
        )}
      </Card>

      <ShareControls
        shareUrl={shareUrl}
        canShare={prog.visibilite !== "PRIVE"}
        programmeNom={prog.nom}
      />
    </div>
  );
}
