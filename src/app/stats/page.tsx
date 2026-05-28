import Link from "next/link";
import { Dumbbell, Flame, Medal, Timer, TrendingUp, Trophy } from "lucide-react";

import { auth } from "@/lib/auth";
import { Card, CardLabel } from "@/components/ui/card";
import { buildStats, type Period } from "@/lib/stats";
import { formatDuree } from "@/lib/seance";

import { PeriodTabs } from "./_period-tabs";
import { Heatmap } from "./_heatmap";
import { ProgressionChart } from "./_progression-chart";
import { MuscleDistribution } from "./_muscle-distribution";

type SearchParams = Promise<{ period?: string }>;

const VALID_PERIODS: Period[] = ["mois", "3mois", "annee"];

export default async function StatsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;
  const period = (VALID_PERIODS.find((p) => p === params.period) ??
    "mois") as Period;

  if (!session?.user?.id) {
    return (
      <div className="px-4 pt-5 pb-8">
        <h1 className="text-lg font-semibold">Stats</h1>
        <p className="mt-1 text-xs text-muted-strong">
          Connecte-toi pour voir tes progressions.
        </p>
        <Link
          href="/auth/login?callbackUrl=/stats"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white"
        >
          Me connecter
        </Link>
      </div>
    );
  }

  let stats;
  let dbError = false;
  try {
    stats = await buildStats({ userId: session.user.id, period });
  } catch {
    dbError = true;
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Stats</h1>
          <p className="mt-0.5 text-[11px] text-muted">
            Heatmap, courbes 1RM, répartition muscles, PRs.
          </p>
        </div>
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1 rounded-full border border-card-border bg-card px-3 py-1.5 text-[11px] font-medium text-accent-soft hover:border-accent-border"
        >
          <Trophy className="size-3" />
          Classement
        </Link>
      </header>

      <PeriodTabs />

      {dbError || !stats ? (
        <Card className="mt-4 border-danger/30 bg-danger/5 text-xs text-danger">
          Impossible de charger tes stats. La BDD est peut-être déconnectée.
        </Card>
      ) : (
        <>
          {/* 4 cartes résumé */}
          <section className="mt-4 grid grid-cols-2 gap-2">
            <SummaryCard
              label="Séances"
              value={stats.summary.seancesCount}
              icon={Dumbbell}
            />
            <SummaryCard
              label="Volume"
              value={
                stats.summary.volumeKg > 0
                  ? `${(stats.summary.volumeKg / 1000).toFixed(1)}t`
                  : "0"
              }
              icon={TrendingUp}
            />
            <SummaryCard
              label="Durée moy."
              value={
                stats.summary.dureeMoyenneSec > 0
                  ? formatDuree(stats.summary.dureeMoyenneSec)
                  : "—"
              }
              icon={Timer}
            />
            <SummaryCard
              label="Streak"
              value={`${stats.summary.streakActuel}`}
              icon={Flame}
              suffix={stats.summary.streakActuel > 0 ? "séances" : ""}
            />
          </section>

          {/* Heatmap */}
          <section className="mt-5">
            <CardLabel className="mb-2 px-1">Activité</CardLabel>
            <Card>
              <Heatmap cells={stats.heatmap.cells} />
            </Card>
          </section>

          {/* Progression chart */}
          <section className="mt-5">
            <ProgressionChart exos={stats.exoProgression} />
          </section>

          {/* Muscle distribution */}
          <section className="mt-5">
            <CardLabel className="mb-2 px-1">Répartition musculaire</CardLabel>
            <Card>
              <MuscleDistribution slices={stats.muscleDistribution} />
            </Card>
          </section>

          {/* PRs all-time */}
          <section className="mt-5">
            <CardLabel className="mb-2 px-1">PRs all-time</CardLabel>
            {stats.prs.length === 0 ? (
              <Card className="py-6 text-center text-xs text-muted-strong">
                Aucun PR pour l&apos;instant. Termine une séance avec un poids
                conséquent.
              </Card>
            ) : (
              <ul className="flex flex-col gap-2">
                {stats.prs.map((pr, idx) => (
                  <li key={pr.prId}>
                    <Link href={`/exercices/${pr.exerciceId}`}>
                      <Card
                        highlighted={idx < 3}
                        className="flex items-center gap-3 transition-colors hover:border-accent-border"
                      >
                        <TrophyMedal rank={idx + 1} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {pr.exerciceNom}
                          </p>
                          <p className="text-[10px] text-muted">
                            {pr.date.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold">
                            {pr.isLeste
                              ? pr.bwPlusKg != null
                                ? `BW+${pr.bwPlusKg}`
                                : "BW"
                              : `${pr.poidsKg}kg`}{" "}
                            × {pr.reps}
                          </p>
                          <p className="text-[10px] text-muted">
                            1RM ~{Math.round(pr.oneRmKg)}kg
                          </p>
                        </div>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  suffix,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  suffix?: string;
}) {
  return (
    <Card className="flex flex-col gap-1.5 py-3">
      <div className="flex items-center gap-1.5 text-muted">
        <Icon className="size-3" />
        <CardLabel>{label}</CardLabel>
      </div>
      <p className="text-xl font-medium">{value}</p>
      {suffix && <p className="text-[10px] text-muted">{suffix}</p>}
    </Card>
  );
}

function TrophyMedal({ rank }: { rank: number }) {
  const color =
    rank === 1
      ? "text-gold"
      : rank === 2
        ? "text-silver"
        : rank === 3
          ? "text-bronze"
          : "text-muted";
  const Icon = rank <= 3 ? Trophy : Medal;
  return (
    <div
      className={`grid size-9 place-items-center rounded-full bg-bg ${color}`}
    >
      <Icon className="size-5" />
    </div>
  );
}
