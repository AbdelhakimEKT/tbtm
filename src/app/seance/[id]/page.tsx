import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Dumbbell,
  Flame,
  Home as HomeIcon,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  Trophy,
  XCircle,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MUSCLE_LABEL } from "@/lib/labels";
import { formatDuree, levelFromXp, xpProgress } from "@/lib/seance";
import { cn } from "@/lib/cn";
import { BadgeIcon } from "@/components/badge-icon";
import { BADGE_RARETE_LABEL } from "@/lib/labels";

import { ShareSeanceButton } from "./_share-button";
import { DeleteSeanceButton } from "./_delete-button";

type Params = Promise<{ id: string }>;

export default async function SeanceRecapPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/seance/${id}`);
  }

  const seance = await prisma.seance.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      dureeSec: true,
      volumeTotalKg: true,
      noteDeFormeDuJour: true,
      statut: true,
      xpGagne: true,
      userId: true,
      programme: { select: { id: true, nom: true } },
      sets: {
        where: { validated: true },
        orderBy: [{ exerciceId: "asc" }, { ordre: "asc" }],
        select: {
          id: true,
          ordre: true,
          poidsKg: true,
          bwPlusKg: true,
          reps: true,
          rir: true,
          isBonus: true,
          notes: true,
          exercice: {
            select: { id: true, nom: true, muscles: true, isLeste: true },
          },
        },
      },
      prs: {
        select: {
          id: true,
          poidsKg: true,
          bwPlusKg: true,
          reps: true,
          oneRmKg: true,
          exercice: {
            select: { id: true, nom: true, isLeste: true },
          },
        },
      },
    },
  });

  if (!seance) notFound();
  if (seance.userId !== session.user.id && session.user.role !== "ADMIN") {
    redirect("/");
  }

  if (seance.statut === "EN_COURS") {
    redirect(`/seance/${id}/live`);
  }

  // User stats actuelles pour la barre XP
  const user = await prisma.user.findUnique({
    where: { id: seance.userId },
    select: { xp: true, niveau: true, streakActuel: true },
  });

  // Badges débloqués pendant cette séance (= depuis le début de la séance)
  const newBadges = await prisma.userBadge.findMany({
    where: {
      userId: seance.userId,
      debloqueAt: { gte: seance.date },
    },
    orderBy: { debloqueAt: "asc" },
    select: {
      id: true,
      debloqueAt: true,
      badge: {
        select: {
          slug: true,
          nom: true,
          description: true,
          icone: true,
          rarete: true,
        },
      },
    },
  });

  // Pour le breakdown XP, on essaie de retrouver la dernière séance avant
  // celle-ci pour récupérer le PR previous (sinon on n'affiche que le delta).
  const previousPRsByExo = await prisma.pR.findMany({
    where: {
      userId: seance.userId,
      seanceId: { not: seance.id },
      exerciceId: { in: seance.prs.map((p) => p.exercice.id) },
    },
    orderBy: { oneRmKg: "desc" },
    distinct: ["exerciceId"],
    select: { exerciceId: true, oneRmKg: true },
  });
  const prevPRMap = new Map(previousPRsByExo.map((p) => [p.exerciceId, p.oneRmKg]));

  // Regroupe les sets par exercice
  type ExoGroup = {
    exercice: (typeof seance.sets)[number]["exercice"];
    sets: (typeof seance.sets)[number][];
    hadPR: boolean;
  };
  const prExoIds = new Set(seance.prs.map((p) => p.exercice.id));
  const groupedMap = new Map<string, ExoGroup>();
  for (const s of seance.sets) {
    const key = s.exercice.id;
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        exercice: s.exercice,
        sets: [],
        hadPR: prExoIds.has(key),
      });
    }
    groupedMap.get(key)!.sets.push(s);
  }
  const grouped = Array.from(groupedMap.values()).sort((a, b) =>
    Number(b.hadPR) - Number(a.hadPR),
  );

  const totalSeries = seance.sets.length;
  const totalReps = seance.sets.reduce((acc, s) => acc + s.reps, 0);
  const isCancelled = seance.statut === "ANNULEE";

  // Reconstitue le breakdown XP en gros (au cas où l'utilisateur recharge)
  const xpFromSeance = isCancelled ? 0 : seance.xpGagne > 0 ? 100 : 0;
  const xpFromPRs = seance.prs.length * 75;
  const xpFromStreak = Math.max(0, seance.xpGagne - xpFromSeance - xpFromPRs);

  // Niveau actuel & progression
  const userXp = user?.xp ?? 0;
  const niveau = user?.niveau ?? levelFromXp(userXp);
  const prog = user ? xpProgress(userXp) : null;
  const niveauAvant =
    seance.xpGagne > 0 ? levelFromXp(userXp - seance.xpGagne) : niveau;
  const leveledUp = niveau > niveauAvant;

  const shareText = buildShareText({
    programmeNom: seance.programme?.nom,
    dureeSec: seance.dureeSec ?? 0,
    volumeKg: seance.volumeTotalKg,
    nbSeries: totalSeries,
    nbPRs: seance.prs.length,
    isCancelled,
  });

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Accueil"
          className="grid size-9 place-items-center rounded-full border border-card-border bg-card text-muted-strong hover:text-fg"
        >
          <HomeIcon className="size-4" />
        </Link>
        <span
          className={
            isCancelled
              ? "inline-flex items-center gap-1 rounded-full bg-danger/15 px-3 py-1 text-[10px] font-medium text-danger"
              : "inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-[10px] font-medium text-success"
          }
        >
          {isCancelled ? (
            <>
              <XCircle className="size-3" /> Abandonnée
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3" /> Terminée
            </>
          )}
        </span>
      </header>

      <section className="mt-2">
        <h1 className="text-2xl font-semibold">
          {isCancelled
            ? "Séance abandonnée"
            : seance.prs.length >= 3
              ? `Séance record · ${seance.prs.length} PRs 🔥`
              : seance.prs.length === 2
                ? "Double PR 🔥"
                : seance.prs.length === 1
                  ? "Nouveau PR 🏆"
                  : "GG, séance bouclée"}
        </h1>
        <p className="mt-1 text-[11px] text-muted">
          {seance.programme?.nom ?? "Séance libre"} ·{" "}
          {seance.date.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2">
        <StatCard
          label="Durée"
          icon={Timer}
          value={seance.dureeSec ? formatDuree(seance.dureeSec) : "—"}
        />
        <StatCard
          label="Volume"
          icon={TrendingUp}
          value={
            seance.volumeTotalKg > 0
              ? `${(seance.volumeTotalKg / 1000).toFixed(1)}t`
              : "0kg"
          }
        />
        <StatCard label="Séries" icon={Dumbbell} value={totalSeries} />
        <StatCard label="Reps" icon={Calendar} value={totalReps} />
      </section>

      {seance.noteDeFormeDuJour && (
        <Card className="mt-3 flex items-center gap-3 py-3">
          <CardLabel>Forme du jour</CardLabel>
          <div className="ml-auto flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={
                  n <= (seance.noteDeFormeDuJour ?? 0)
                    ? "size-4 fill-gold text-gold"
                    : "size-4 text-muted"
                }
              />
            ))}
          </div>
        </Card>
      )}

      {/* PR détectés */}
      {seance.prs.length > 0 && (
        <section className="mt-4">
          <CardLabel className="mb-2 px-1 text-gold">
            🏆 {seance.prs.length} nouveau{seance.prs.length > 1 ? "x" : ""} PR
            {seance.prs.length > 1 ? "s" : ""}
          </CardLabel>
          <Card highlighted className="flex flex-col gap-2">
            {seance.prs.map((pr) => {
              const prev = prevPRMap.get(pr.exercice.id);
              const delta = prev != null ? pr.oneRmKg - prev : null;
              return (
                <Link
                  key={pr.id}
                  href={`/exercices/${pr.exercice.id}`}
                  className="flex items-center gap-3 rounded-lg bg-bg px-3 py-2 hover:bg-bg/60"
                >
                  <Trophy className="size-5 text-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {pr.exercice.nom}
                    </p>
                    <p className="text-[10px] text-muted">
                      {pr.exercice.isLeste
                        ? pr.bwPlusKg != null
                          ? `BW+${pr.bwPlusKg}`
                          : "BW"
                        : `${pr.poidsKg}kg`}{" "}
                      × {pr.reps} reps · 1RM ~{Math.round(pr.oneRmKg)}kg
                    </p>
                  </div>
                  {delta != null && delta > 0 && (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                      +{Math.round(delta * 10) / 10}kg
                    </span>
                  )}
                </Link>
              );
            })}
          </Card>
        </section>
      )}

      {/* Breakdown XP */}
      {!isCancelled && seance.xpGagne > 0 && (
        <section className="mt-4">
          <Card highlighted className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-accent text-white">
                <Sparkles className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">+{seance.xpGagne} XP gagnés</p>
                {prog && (
                  <p className="text-[11px] text-muted">
                    Niveau {niveau} · {prog.xpDansPalier}/{prog.xpPourPalier} XP
                  </p>
                )}
              </div>
            </div>
            {prog && (
              <div className="h-1.5 overflow-hidden rounded-full bg-bar-idle">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${prog.pct}%` }}
                />
              </div>
            )}
            <ul className="grid grid-cols-3 gap-2 text-[10px]">
              <XpLine label="Séance" value={xpFromSeance} />
              <XpLine
                label={`${seance.prs.length} PR${seance.prs.length > 1 ? "s" : ""}`}
                value={xpFromPRs}
                color="text-gold"
              />
              <XpLine
                label="Streak"
                value={xpFromStreak}
                color="text-accent-soft"
              />
            </ul>
          </Card>
        </section>
      )}

      {leveledUp && (
        <section className="mt-3">
          <Card className="flex items-center gap-3 border-gold/40 bg-gold/5">
            <div className="grid size-10 place-items-center rounded-full bg-gold text-bg">
              <Sparkles className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gold">
                Achievement unlocked
              </p>
              <p className="text-[11px] text-muted-strong">
                T&apos;es passé niveau {niveau}. T&apos;es bon tu montes 📈
              </p>
            </div>
          </Card>
        </section>
      )}

      {/* Nouveaux badges débloqués */}
      {newBadges.length > 0 && (
        <section className="mt-3">
          <CardLabel className="mb-2 px-1 text-gold">
            🎖️ Achievement{newBadges.length > 1 ? "s" : ""} unlocked
          </CardLabel>
          <Card className="flex flex-col gap-2 border-gold/40 bg-gold/5">
            {newBadges.map((ub) => (
              <Link
                key={ub.id}
                href="/badges"
                className="flex items-center gap-3 rounded-lg bg-bg px-3 py-2 hover:bg-bg/60"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/20 text-gold">
                  <BadgeIcon iconName={ub.badge.icone} className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ub.badge.nom}</p>
                  <p className="line-clamp-2 text-[10px] text-muted-strong">
                    {ub.badge.description}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[9px] uppercase tracking-wide text-gold">
                  {BADGE_RARETE_LABEL[ub.badge.rarete]}
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      {!isCancelled && user && user.streakActuel > 0 && (
        <Card className="mt-3 flex items-center gap-3 py-3">
          <Flame className="size-5 text-accent" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              Streak : {user.streakActuel} séance{user.streakActuel > 1 ? "s" : ""}
            </p>
            <p className="text-[11px] text-muted">
              T&apos;as pas FF15. Tiens bon.
            </p>
          </div>
        </Card>
      )}

      {/* Détails par exercice */}
      <section className="mt-5">
        <CardLabel className="mb-2 px-1">
          Détails ({grouped.length} exercice{grouped.length > 1 ? "s" : ""})
        </CardLabel>
        {grouped.length === 0 ? (
          <Card className="py-6 text-center text-xs text-muted-strong">
            Aucune série validée.
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {grouped.map((g) => (
              <li key={g.exercice.id}>
                <Card
                  highlighted={g.hadPR}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/exercices/${g.exercice.id}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                    >
                      {g.exercice.nom}
                    </Link>
                    {g.hadPR && (
                      <Trophy
                        className="size-4 shrink-0 text-gold"
                        aria-label="PR"
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.exercice.muscles.slice(0, 3).map((m) => (
                      <span
                        key={m}
                        className="rounded-full bg-accent-bg px-1.5 py-0.5 text-[9px] text-accent-soft"
                      >
                        {MUSCLE_LABEL[m]}
                      </span>
                    ))}
                  </div>
                  <ul className="flex flex-col gap-1">
                    {g.sets.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-md bg-bg px-2.5 py-1.5 text-[11px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-muted">
                            {s.isBonus ? "Bonus" : `Série ${s.ordre}`}
                          </span>
                          <span>
                            <span className="font-semibold">
                              {g.exercice.isLeste
                                ? s.bwPlusKg != null
                                  ? `BW+${s.bwPlusKg}`
                                  : "BW"
                                : `${s.poidsKg}kg`}
                            </span>
                            <span className="mx-1 text-muted">×</span>
                            <span className="font-semibold">{s.reps}</span>
                            {s.rir != null && (
                              <span className="ml-2 text-muted">
                                RIR {s.rir}
                              </span>
                            )}
                          </span>
                        </div>
                        {s.notes && (
                          <p className="mt-0.5 text-[10px] italic text-muted-strong">
                            {s.notes}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-2">
        <ShareSeanceButton text={shareText} />
        <Link href="/">
          <Button type="button" size="lg" className="w-full">
            <HomeIcon className="size-4" /> Retour accueil
          </Button>
        </Link>
        {seance.programme && (
          <Link
            href={`/programmes/${seance.programme.id}`}
            className="text-center text-[11px] text-muted-strong underline-offset-2 hover:underline"
          >
            voir le programme {seance.programme.nom} →
          </Link>
        )}
        {seance.userId === session.user.id && (
          <DeleteSeanceButton seanceId={seance.id} />
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="flex items-center gap-3 py-3">
      <div className="grid size-9 place-items-center rounded-xl bg-accent-bg text-accent-soft">
        <Icon className="size-4" />
      </div>
      <div>
        <CardLabel>{label}</CardLabel>
        <p className="text-base font-medium">{value}</p>
      </div>
    </Card>
  );
}

function XpLine({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <li className="rounded-md bg-bg/40 p-2 text-center">
      <p className={cn("text-sm font-medium", color ?? "text-fg")}>
        +{value}
      </p>
      <p className="text-[9px] text-muted">{label}</p>
    </li>
  );
}

function buildShareText(args: {
  programmeNom?: string;
  dureeSec: number;
  volumeKg: number;
  nbSeries: number;
  nbPRs: number;
  isCancelled: boolean;
}): string {
  if (args.isCancelled) return "Séance abandonnée. On y retourne demain.";

  const parts: string[] = [];
  if (args.nbPRs > 0) {
    parts.push(
      args.nbPRs >= 3
        ? `🔥 ${args.nbPRs} nouveaux PRs en une séance`
        : args.nbPRs === 2
          ? "🔥 2 nouveaux PRs"
          : "🏆 Nouveau PR",
    );
  } else {
    parts.push("GG, séance bouclée");
  }
  if (args.programmeNom) parts.push(`Programme : ${args.programmeNom}`);
  parts.push(`Durée : ${formatDuree(args.dureeSec)}`);
  if (args.volumeKg > 0) {
    parts.push(`Volume : ${(args.volumeKg / 1000).toFixed(1)}t soulevés`);
  }
  parts.push(`${args.nbSeries} séries`);
  parts.push("");
  parts.push("— via TBTM");
  return parts.join("\n");
}
