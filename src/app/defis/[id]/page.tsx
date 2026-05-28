import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crown,
  Flag,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardLabel } from "@/components/ui/card";
import { formatDuree } from "@/lib/seance";

import {
  acceptDefi,
  cancelDefi,
  refuseDefi,
  startSeanceForDefi,
} from "../_actions";
import { CommentsThread } from "./_comments";

type Params = Promise<{ id: string }>;

export default async function DefiDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/defis/${id}`);
  }

  const defi = await prisma.defi.findUnique({
    where: { id },
    select: {
      id: true,
      titre: true,
      message: true,
      statut: true,
      createdAt: true,
      lanceParId: true,
      lancePar: { select: { id: true, pseudo: true, avatar: true } },
      programme: {
        select: {
          id: true,
          nom: true,
          _count: { select: { exercices: true } },
        },
      },
      participants: {
        orderBy: [
          { statut: "asc" }, // EN_ATTENTE / ACCEPTE / COMPLETE / REFUSE
          { completedAt: "asc" },
        ],
        select: {
          id: true,
          statut: true,
          userId: true,
          volumeTotalKg: true,
          dureeSec: true,
          repsTotal: true,
          completedAt: true,
          seanceId: true,
          user: {
            select: {
              id: true,
              pseudo: true,
              avatar: true,
              niveau: true,
            },
          },
        },
      },
      commentaires: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          message: true,
          createdAt: true,
          userId: true,
          user: { select: { pseudo: true, avatar: true } },
        },
      },
    },
  });

  if (!defi) notFound();

  // Vérif accès : je dois être participant
  const myParticipation = defi.participants.find(
    (p) => p.userId === session.user.id,
  );
  if (!myParticipation && session.user.role !== "ADMIN") {
    redirect("/defis");
  }

  const isCreator = defi.lanceParId === session.user.id;
  const completedCount = defi.participants.filter(
    (p) => p.statut === "COMPLETE",
  ).length;

  // Tri pour affichage stats : COMPLETE par volume desc, puis autres
  const completed = defi.participants
    .filter((p) => p.statut === "COMPLETE")
    .sort((a, b) => (b.volumeTotalKg ?? 0) - (a.volumeTotalKg ?? 0));
  const pending = defi.participants.filter((p) => p.statut !== "COMPLETE");

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
        <StatusBadge defiStatus={defi.statut} />
      </header>

      <section>
        <div className="flex items-center gap-2">
          {isCreator && <Crown className="size-4 text-gold" />}
          <h1 className="text-2xl font-semibold">
            {defi.titre ?? `Défi sur ${defi.programme.nom}`}
          </h1>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          Lancé par {defi.lancePar.pseudo} ·{" "}
          {defi.createdAt.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}{" "}
          · Programme{" "}
          <Link
            href={`/programmes/${defi.programme.id}`}
            className="text-accent-soft hover:underline"
          >
            {defi.programme.nom}
          </Link>
        </p>

        {defi.message && (
          <Card highlighted className="mt-3 py-3">
            <p className="text-sm italic text-fg">« {defi.message} »</p>
            <p className="mt-1 text-[10px] text-muted">
              — {defi.lancePar.pseudo}
            </p>
          </Card>
        )}
      </section>

      {/* Mon action principale */}
      {myParticipation && defi.statut === "EN_COURS" && (
        <section className="mt-4">
          {myParticipation.statut === "EN_ATTENTE" && (
            <PendingActions participantId={myParticipation.id} />
          )}
          {myParticipation.statut === "ACCEPTE" && !myParticipation.seanceId && (
            <form action={startSeanceForDefi}>
              <input
                type="hidden"
                name="defiParticipantId"
                value={myParticipation.id}
              />
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-white shadow-lg shadow-accent/30 transition-transform active:scale-[0.98]"
              >
                <Zap className="size-4" /> Lancer ma séance maintenant
              </button>
            </form>
          )}
          {myParticipation.statut === "ACCEPTE" && myParticipation.seanceId && (
            <Link
              href={`/seance/${myParticipation.seanceId}/live`}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-white shadow-lg shadow-accent/30"
            >
              <Zap className="size-4" /> Reprendre ma séance
            </Link>
          )}
          {myParticipation.statut === "COMPLETE" && (
            <Card highlighted className="flex items-center gap-3 py-3">
              <CheckCircle2 className="size-5 text-success" />
              <div className="flex-1">
                <p className="text-sm font-medium">Tu l&apos;as fait !</p>
                <p className="text-[10px] text-muted">
                  En attendant les autres…
                </p>
              </div>
            </Card>
          )}
          {myParticipation.statut === "REFUSE" && (
            <Card className="flex items-center gap-3 border-danger/30 bg-danger/5 py-3">
              <XCircle className="size-5 text-danger" />
              <p className="flex-1 text-sm">T&apos;as refusé ce défi.</p>
            </Card>
          )}
        </section>
      )}

      {/* Section stats côté-à-côté (si au moins 1 complete) */}
      {completed.length > 0 && (
        <section className="mt-5">
          <CardLabel className="mb-2 inline-flex items-center gap-1 px-1">
            <Trophy className="size-3 text-gold" />
            Résultats ({completed.length}/{defi.participants.length})
          </CardLabel>
          <ul className="flex flex-col gap-2">
            {completed.map((p, idx) => (
              <li key={p.id}>
                <ResultRow
                  participant={p}
                  rank={idx + 1}
                  isMe={p.userId === session.user.id}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Participants en attente / accepté */}
      {pending.length > 0 && (
        <section className="mt-5">
          <CardLabel className="mb-2 inline-flex items-center gap-1 px-1">
            <Clock className="size-3" />
            En attente ({pending.length})
          </CardLabel>
          <ul className="flex flex-col gap-1.5">
            {pending.map((p) => (
              <li key={p.id}>
                <PendingRow
                  participant={p}
                  isMe={p.userId === session.user.id}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Annuler (créateur uniquement) */}
      {isCreator && defi.statut === "EN_COURS" && completedCount === 0 && (
        <div className="mt-5">
          <CancelButton defiId={defi.id} />
        </div>
      )}

      {/* Commentaires */}
      <section className="mt-6">
        <CardLabel className="mb-2 px-1">
          Chambrage ({defi.commentaires.length})
        </CardLabel>
        <CommentsThread
          defiId={defi.id}
          meId={session.user.id}
          comments={defi.commentaires}
          canPost={!!myParticipation}
        />
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components (server-side for purely visual ones)
// ----------------------------------------------------------------------------

function StatusBadge({
  defiStatus,
}: {
  defiStatus: "OUVERT" | "EN_COURS" | "TERMINE" | "ANNULE";
}) {
  if (defiStatus === "TERMINE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-[10px] font-medium text-success">
        <Flag className="size-3" />
        Terminé
      </span>
    );
  }
  if (defiStatus === "ANNULE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-3 py-1 text-[10px] font-medium text-danger">
        <XCircle className="size-3" />
        Annulé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-bg px-3 py-1 text-[10px] font-medium text-accent-soft">
      <Zap className="size-3" />
      En cours
    </span>
  );
}

function ResultRow({
  participant: p,
  rank,
  isMe,
}: {
  participant: {
    id: string;
    user: { pseudo: string; avatar: string | null; niveau: number };
    volumeTotalKg: number | null;
    dureeSec: number | null;
    repsTotal: number | null;
    completedAt: Date | null;
    seanceId: string | null;
  };
  rank: number;
  isMe: boolean;
}) {
  const rankColors = {
    1: "text-gold",
    2: "text-silver",
    3: "text-bronze",
  } as const;
  const rankColor = (rankColors as Record<number, string>)[rank] ?? "text-muted";

  return (
    <Card
      highlighted={isMe || rank === 1}
      className="flex items-center gap-3"
    >
      <div className="flex w-7 shrink-0 items-center justify-center">
        {rank === 1 ? (
          <Crown className={`size-5 ${rankColor}`} />
        ) : (
          <span className={`text-sm font-semibold ${rankColor}`}>{rank}</span>
        )}
      </div>
      <Avatar name={p.user.pseudo} src={p.user.avatar} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {p.user.pseudo}
          {isMe && (
            <span className="ml-1 text-[10px] font-normal text-muted">
              (toi)
            </span>
          )}
        </p>
        <p className="text-[10px] text-muted">
          {p.volumeTotalKg
            ? `${(p.volumeTotalKg / 1000).toFixed(1)}t`
            : "0kg"}{" "}
          · {p.dureeSec ? formatDuree(p.dureeSec) : "—"} · {p.repsTotal ?? 0} reps
        </p>
      </div>
      {p.seanceId && (
        <Link
          href={`/seance/${p.seanceId}`}
          className="inline-flex items-center gap-1 text-[10px] text-accent-soft hover:underline"
        >
          détails →
        </Link>
      )}
    </Card>
  );
}

function PendingRow({
  participant: p,
  isMe,
}: {
  participant: {
    id: string;
    statut: "EN_ATTENTE" | "ACCEPTE" | "REFUSE" | "COMPLETE";
    user: { pseudo: string; avatar: string | null; niveau: number };
  };
  isMe: boolean;
}) {
  return (
    <Card className="flex items-center gap-3">
      <Avatar name={p.user.pseudo} src={p.user.avatar} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs">
          {p.user.pseudo}
          {isMe && (
            <span className="ml-1 text-[10px] text-muted">(toi)</span>
          )}
        </p>
        <p className="text-[9px] text-muted">Niv. {p.user.niveau}</p>
      </div>
      {p.statut === "EN_ATTENTE" && (
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[9px] text-warning">
          n&apos;a pas répondu
        </span>
      )}
      {p.statut === "ACCEPTE" && (
        <span className="rounded-full bg-accent-bg px-2 py-0.5 text-[9px] text-accent-soft">
          accepté
        </span>
      )}
      {p.statut === "REFUSE" && (
        <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[9px] text-danger">
          refusé
        </span>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Client wrappers (need server actions)
// ----------------------------------------------------------------------------

function PendingActions({ participantId }: { participantId: string }) {
  return (
    <Card highlighted className="flex flex-col gap-2 py-3">
      <p className="text-center text-sm">T&apos;as été ping. Tu fais quoi ?</p>
      <div className="flex gap-2">
        <form action={refuseWithRedirect.bind(null, participantId)} className="flex-1">
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-card-border bg-card text-xs font-medium text-muted-strong"
          >
            <XCircle className="size-3.5" />
            Refuser
          </button>
        </form>
        <form action={acceptWithRedirect.bind(null, participantId)} className="flex-1">
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-xs font-medium text-white shadow-sm shadow-accent/30"
          >
            <CheckCircle2 className="size-3.5" />
            Accepter
          </button>
        </form>
      </div>
    </Card>
  );
}

function CancelButton({ defiId }: { defiId: string }) {
  return (
    <form action={cancelWithRefresh.bind(null, defiId)}>
      <button
        type="submit"
        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 text-[11px] font-medium text-danger"
      >
        Annuler le défi
      </button>
    </form>
  );
}

// ----------------------------------------------------------------------------
// Server-action wrappers (binding pattern)
// ----------------------------------------------------------------------------

async function acceptWithRedirect(participantId: string) {
  "use server";
  await acceptDefi(participantId);
}
async function refuseWithRedirect(participantId: string) {
  "use server";
  await refuseDefi(participantId);
}
async function cancelWithRefresh(defiId: string) {
  "use server";
  await cancelDefi(defiId);
}
