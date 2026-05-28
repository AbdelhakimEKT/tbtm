import Link from "next/link";
import type { Muscle, Visibilite } from "@prisma/client";
import { Flame, Globe, Lock, Users } from "lucide-react";

import { MUSCLE_LABEL } from "@/lib/labels";
import { Card } from "@/components/ui/card";

export type ProgrammeListItem = {
  id: string;
  nom: string;
  description: string | null;
  tags: Muscle[];
  visibilite: Visibilite;
  estProgrammeActif: boolean;
  frequenceHebdo: number | null;
  updatedAt: Date;
  createdById: string;
  createdBy: { pseudo: string };
  _count: { exercices: number };
};

const VISIBILITE_ICON: Record<Visibilite, React.ComponentType<{ className?: string }>> = {
  PRIVE: Lock,
  AMIS: Users,
  COMMUNAUTE: Globe,
};

export function ProgrammeCard({
  programme: p,
  currentUserId,
}: {
  programme: ProgrammeListItem;
  currentUserId?: string;
}) {
  const isMine = currentUserId && p.createdById === currentUserId;
  const VisibIcon = VISIBILITE_ICON[p.visibilite];

  return (
    <Link href={`/programmes/${p.id}`}>
      <Card
        highlighted={p.estProgrammeActif}
        className="flex flex-col gap-2 transition-colors hover:border-accent-border"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{p.nom}</p>
              {p.estProgrammeActif && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-accent-soft">
                  <Flame className="size-2.5" />
                  Actif
                </span>
              )}
            </div>
            {p.description && (
              <p className="mt-1 line-clamp-2 text-[11px] text-muted-strong">
                {p.description}
              </p>
            )}
          </div>
          <VisibIcon className="size-3.5 shrink-0 text-muted" />
        </div>

        {p.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.tags.slice(0, 4).map((m) => (
              <span
                key={m}
                className="rounded-full bg-accent-bg px-2 py-0.5 text-[10px] text-accent-soft"
              >
                {MUSCLE_LABEL[m]}
              </span>
            ))}
            {p.tags.length > 4 && (
              <span className="text-[10px] text-muted">+{p.tags.length - 4}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-muted">
          <div className="flex items-center gap-2">
            <span>
              {p._count.exercices} exo{p._count.exercices > 1 ? "s" : ""}
            </span>
            {p.frequenceHebdo && (
              <>
                <span>·</span>
                <span>{p.frequenceHebdo}×/sem</span>
              </>
            )}
          </div>
          {!isMine && <span>par {p.createdBy.pseudo}</span>}
        </div>
      </Card>
    </Link>
  );
}
